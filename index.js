require('dotenv').config();

const {
    Client,
    GatewayIntentBits
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =========================
// CONFIG
// =========================

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

const MUSIC_CHANNEL_ID = process.env.MUSIC_CHANNEL_ID;
const AUTO_DELETE_CHANNEL_ID = process.env.AUTO_DELETE_CHANNEL_ID;

// =========================
// DISCORD HELPERS
// =========================

async function sendLongMessage(channel, text) {
    const MAX_LENGTH = 1900;

    if (text.length <= MAX_LENGTH) {
        await channel.send(text);
        return;
    }

    let remaining = text;

    while (remaining.length > 0) {
        let chunk = remaining.slice(0, MAX_LENGTH);

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

        console.log(
            'Đang kiểm tra bot messages cũ trong #music...'
        );

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

                const age =
                    Date.now() - message.createdTimestamp;

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

    console.log(
        `Music channel: ${MUSIC_CHANNEL_ID || 'chưa cấu hình'}`
    );
const updateStats = async () => {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    await guild.members.fetch();

    const residents = guild.members.cache.filter(
        m => !m.user.bot
    ).size;

    const bots = guild.members.cache.filter(
        m => m.user.bot
    ).size;

    const online = guild.members.cache.filter(
        m =>
            !m.user.bot &&
            m.presence &&
            m.presence.status !== 'offline'
    ).size;

    const residentsChannel =
        guild.channels.cache.get('1548535639732125746');

    const keeperChannel =
        guild.channels.cache.get('1548543499018960936');

    const onlineChannel =
        guild.channels.cache.get('1548941016768315433');

    if (residentsChannel) {
        await residentsChannel.setName(
            `👥 Residents: ${residents}`
        );
    }

    if (keeperChannel) {
        await keeperChannel.setName(
            `🤖 Keeper: ${bots}`
        );
    }

    if (onlineChannel) {
        await onlineChannel.setName(
            `🟢 Online: ${online}`
        );
    }
};

await updateStats();
setInterval(updateStats, 10 * 60 * 1000);
    await cleanupOldBotMessages();
});

// =========================
// MESSAGE HANDLER
// =========================

client.on('messageCreate', async (message) => {

    // Bỏ qua tất cả bot
    if (message.author.bot) return;


    // =========================
    // !clear
    // =========================

    if (message.content.startsWith('!clear')) {

        // Chỉ người có quyền Manage Messages
        // mới được sử dụng
        if (
            !message.member.permissions.has('ManageMessages')
        ) {
            const reply = await message.reply(
                'K không có quyền dùng lệnh này 😭'
            );

            setTimeout(() => {
                reply.delete().catch(() => {});
            }, 3000);

            return;
        }

        const args =
            message.content.trim().split(/\s+/);

        const amount =
            parseInt(args[1], 10);

        // Chỉ cho phép 1-100
        if (
            !amount ||
            amount < 1 ||
            amount > 100
        ) {
            const reply = await message.reply(
                'Dùng như này: `!clear 10` (1-100)'
            );

            setTimeout(() => {
                reply.delete().catch(() => {});
            }, 4000);

            return;
        }

        try {

            // Xóa chính command !clear
            await message.delete();

            // Xóa message trong CHÍNH CHANNEL
            // nơi K vừa gõ command
            const deleted =
                await message.channel.bulkDelete(
                    amount,
                    true
                );

            const reply =
                await message.channel.send(
                    `🧹 Đã xóa **${deleted.size}** tin nhắn.`
                );

            // Xóa thông báo sau 3 giây
            setTimeout(() => {
                reply.delete().catch(() => {});
            }, 3000);

        } catch (error) {

            console.error(
                'Clear error:',
                error
            );

        }

        return;
    }


    // =========================
    // #MUSIC
    // =========================

    if (
    message.channel.id === MUSIC_CHANNEL_ID ||
    message.channel.id === AUTO_DELETE_CHANNEL_ID
    ) {

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
});

// =========================
// LOGIN
// =========================

client.login(
    process.env.DISCORD_TOKEN
);
