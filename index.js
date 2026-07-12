const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const http = require('http'); // Módulo nativo para abrir el puerto
require('dotenv').config();

// === VINCULACIÓN DEL PUERTO (Para evitar que el hosting se apague) ===
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot online e operativo.');
}).listen(PORT, () => {
    console.log(`Servidor web escuchando en el puerto ${PORT}`);
});
// =====================================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = "!";
const BLOXLINK_API_KEY = "8fe9f751-9316-4fe1-82f7-2438e97db65a";

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/+/);
    const command = args.shift().toLowerCase();

    if (command === 'search') {
        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);

        if (!targetUser) {
            return message.reply("Por favor, menciona a un usuario o provee un ID válido.");
        }

        const url = `https://api.bloxlink.biz/v3/user/${targetUser.id}`;

        try {
            const response = await axios.get(url, {
                headers: { "Authorization": BLOXLINK_API_KEY }
            });

            const robloxId = response.data.robloxId || "No encontrado";

            const embed = new EmbedBuilder()
                .setTitle(`${targetUser.displayName} [${targetUser.id}]`)
                .setColor(0x0099FF)
                .addFields({
                    name: "Users Connected:",
                    value: `<@${targetUser.id}> [${robloxId}]`,
                    inline: false
                });

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            const errorEmbed = new EmbedBuilder()
                .setDescription("❌ Users not founded / doesnt exists")
                .setColor(0xFF0000);

            await message.channel.send({ embeds: [errorEmbed] });
        }
    }
});

client.login(process.env.DISCORD_TOKEN || "TU_TOKEN_DE_DISCORD_AQUÍ");
