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

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

// Khi bot online
client.once('ready', async () => {
    console.log(`Hideout Keeper đã online: ${client.user.tag}`);

    // Dọn những tin nhắn bot đã quá 3 ngày
    try {
        const channel = await client.channels.fetch(process.env.MUSIC_CHANNEL_ID);

        if (!channel || !channel.isTextBased()) return;

        let lastId = undefined;
        const now = Date.now();

        while (true) {
            const options = { limit: 100 };
            if (lastId) options.before = lastId;

            const messages = await channel.messages.fetch(options);

            if (messages.size === 0) break;

            for (const message of messages.values()) {
                lastId = message.id;

                if (
                    message.author.bot &&
                    now - message.createdTimestamp >= THREE_DAYS
                ) {
                    try {
                        await message.delete();
                        console.log(`Đã xóa tin nhắn bot cũ: ${message.id}`);
                    } catch (error) {
                        console.log('Không thể xóa tin nhắn bot:', error.message);
                    }
                }
            }

            // Nếu đã chạm tới tin nhắn cũ hơn 3 ngày thì dừng
            const oldestMessage = messages.last();

            if (
                oldestMessage &&
                now - oldestMessage.createdTimestamp >= THREE_DAYS
            ) {
                break;
            }
        }
    } catch (error) {
        console.log('Không thể dọn tin nhắn cũ:', error.message);
    }
});

client.on('messageCreate', async (message) => {
    // Chỉ xử lý đúng kênh #music
    if (message.channel.id !== process.env.MUSIC_CHANNEL_ID) return;

    // Tin nhắn của BOT → giữ 3 ngày rồi xóa
    if (message.author.bot) {
        setTimeout(async () => {
            try {
                await message.delete();
                console.log(`Đã xóa tin nhắn bot sau 3 ngày: ${message.id}`);
            } catch (error) {
                console.log('Không thể xóa tin nhắn bot:', error.message);
            }
        }, THREE_DAYS);

        return;
    }

    // Tin nhắn của MEMBER → xóa ngay
    try {
        await message.delete();
        console.log(`Đã xóa tin nhắn của ${message.author.tag}`);
    } catch (error) {
        console.log('Không thể xóa tin nhắn:', error.message);
    }
});

client.login(process.env.DISCORD_TOKEN);
