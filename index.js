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

client.once('ready', () => {
    console.log(`Hideout Keeper đã online: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    // Bỏ qua bot
    if (message.author.bot) return;

    // Chỉ xử lý đúng kênh #music
    if (message.channel.id !== process.env.MUSIC_CHANNEL_ID) return;

    // Xóa tin nhắn của member
    try {
        await message.delete();
        console.log(`Đã xóa tin nhắn của ${message.author.tag}`);
    } catch (error) {
        console.log('Không thể xóa tin nhắn:', error.message);
    }
});

client.login(process.env.DISCORD_TOKEN);