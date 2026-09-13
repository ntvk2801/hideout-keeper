require('dotenv').config();

const {
    Client,
    GatewayIntentBits
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =========================
// CONFIG
// =========================

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

const MUSIC_CHANNEL_ID = process.env.MUSIC_CHANNEL_ID;
const AI_CHANNEL_ID = process.env.AI_CHANNEL_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

// Lưu 20 lượt gần nhất trong RAM
const MAX_HISTORY = 20;

let aiHistory = [];

// =========================
// OPENAI
// =========================

async function askGPT(userMessage) {
    if (!OPENAI_API_KEY) {
        throw new Error('Thiếu OPENAI_API_KEY');
    }

    const input = [];

    for (const item of aiHistory) {
        input.push({
            role: item.role,
            content: item.content
        });
    }

    input.push({
        role: 'user',
        content: userMessage
    });

    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',

        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },

        body: JSON.stringify({
            model: OPENAI_MODEL,

            instructions: `
Bạn là Linh, trợ lý AI của server Discord.

Phong cách:
- Nói tiếng Việt tự nhiên.
- Thân thiện, vui vẻ, gần gũi.
- Có thể nói chuyện casual như bạn bè.
- Trả lời rõ ràng, không quá dài nếu câu hỏi đơn giản.
- Không tự nhận mình là Discord bot nếu không cần thiết.
- Khi người dùng nói chuyện bằng tiếng Anh thì có thể trả lời tiếng Anh.
- Không spam emoji.
- Nếu người dùng hỏi điều gì chưa đủ thông tin, hãy hỏi lại ngắn gọn.
            `,

            input,

            // Không lưu response conversation ở phía OpenAI.
            store: false
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('OpenAI API error:', data);
        throw new Error(
            data?.error?.message || `OpenAI API lỗi (${response.status})`
        );
    }

    const answer = data.output_text?.trim();

    if (!answer) {
        throw new Error('OpenAI không trả về nội dung');
    }

    // Lưu context
    aiHistory.push({
        role: 'user',
        content: userMessage
    });

    aiHistory.push({
        role: 'assistant',
        content: answer
    });

    // Chỉ giữ 20 message gần nhất
    if (aiHistory.length > MAX_HISTORY) {
        aiHistory = aiHistory.slice(-MAX_HISTORY);
    }

    return answer;
}

// =========================
// DISCORD HELPERS
// =========================

async function sendLongMessage(channel, text) {
    // Discord giới hạn message khoảng 2000 ký tự.
    const MAX_LENGTH = 1900;

    if (text.length <= MAX_LENGTH) {
        await channel.send(text);
        return;
    }

    let remaining = text;

    while (remaining.length > 0) {
        let chunk = remaining.slice(0, MAX_LENGTH);

        // Cố gắng cắt ở khoảng trắng
        if (remaining.length > MAX_LENGTH) {
            const lastSpace = chunk.lastIndexOf(' ');

            if (lastSpace > 500) {
                chunk = chunk.slice(0, lastSpace);
            }
        }

        await channel.send(chunk.trim());
        remaining = remaining.slice(chunk.length).trim();
    }
}

// =========================
// DELETE OLD BOT MESSAGES
// =========================

async function cleanupOldBotMessages() {
    if (!MUSIC_CHANNEL_ID) {
        console.log('Chưa có MUSIC_CHANNEL_ID');
        return;
    }

    try {
        const channel = await client.channels.fetch(MUSIC_CHANNEL_ID);

        if (!channel || !channel.isTextBased()) {
            console.log('Không tìm thấy #music');
            return;
        }

        console.log('Đang kiểm tra bot messages cũ trong #music...');

        let lastId = null;
        let deletedCount = 0;

        while (true) {
            const options = {
                limit: 100
            };

            if (lastId) {
                options.before = lastId;
            }

            const messages = await channel.messages.fetch(options);

            if (messages.size === 0) {
                break;
            }

            for (const message of messages.values()) {
                lastId = message.id;

                if (!message.author.bot) {
                    continue;
                }

                const age = Date.now() - message.createdTimestamp;

                if (age >= THREE_DAYS) {
                    try {
                        await message.delete();
                        deletedCount++;
                    } catch (error) {
                        console.log(
                            'Không thể xóa bot message cũ:',
                            error.message
                        );
                    }
                }
            }

            if (messages.size < 100) {
                break;
            }
        }

        console.log(
            `Startup cleanup hoàn tất. Đã xóa ${deletedCount} bot message.`
        );

    } catch (error) {
        console.log(
            'Không thể cleanup #music:',
            error.message
        );
    }
}

// =========================
// READY
// =========================

client.once('ready', async () => {
    console.log(
        `Hideout Keeper đã online: ${client.user.tag}`
    );

    console.log(`AI channel: ${AI_CHANNEL_ID || 'chưa cấu hình'}`);
    console.log(`Music channel: ${MUSIC_CHANNEL_ID || 'chưa cấu hình'}`);
    console.log(`OpenAI model: ${OPENAI_MODEL}`);

    // Dọn bot messages #music cũ hơn 3 ngày
    await cleanupOldBotMessages();
});

// =========================
// MESSAGE HANDLER
// =========================

client.on('messageCreate', async (message) => {
    // Bỏ qua tất cả bot
    if (message.author.bot) return;

    // =========================
    // #MUSIC
    // =========================

    if (message.channel.id === MUSIC_CHANNEL_ID) {
        try {
            // Tin nhắn member -> xóa ngay
            await message.delete();

            console.log(
                `Đã xóa tin nhắn của ${message.author.tag}`
            );

        } catch (error) {
            console.log(
                'Không thể xóa tin nhắn member:',
                error.message
            );
        }

        return;
    }

    // =========================
    // #AI
    // =========================

    if (message.channel.id !== AI_CHANNEL_ID) {
        return;
    }

    // Không để message rỗng
    const userMessage = message.content.trim();

    if (!userMessage) {
        return;
    }

    try {
        await message.channel.sendTyping();

        const answer = await askGPT(userMessage);

        await sendLongMessage(
            message.channel,
            answer
        );

    } catch (error) {
        console.error('GPT error:', error);

        await message.reply(
            'Xin lỗi K, Linh đang gặp lỗi khi kết nối với GPT 😭'
        );
    }
});

// =========================
// LOGIN
// =========================

client.login(process.env.DISCORD_TOKEN);
