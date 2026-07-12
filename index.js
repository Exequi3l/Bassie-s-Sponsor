const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const http = require('http');
require('dotenv').config();

// === VINCULACIÓN DEL PUERTO ===
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot online e operativo.');
}).listen(PORT, () => {
    console.log(`Servidor web escuchando en el puerto ${PORT}`);
});
// ==============================

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

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 🔍 1. COMANDO PARA BUSCAR POR DISCORD (Mención o ID)
    if (command === 'discordsearch') {
        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);

        if (!targetUser) {
            const errorEmbed = new EmbedBuilder()
                .setDescription("❌ Users not founded / doesnt exists")
                .setColor(0xFF0000);
            return message.channel.send({ embeds: [errorEmbed] });
        }

        const url = `https://api.bloxlink.biz/v3/user/${targetUser.id}`;

        try {
            const response = await axios.get(url, {
                headers: { "Authorization": BLOXLINK_API_KEY }
            });

            const robloxId = response.data.robloxId;
            if (!robloxId) throw new Error("No vinculado");

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

    // 🔍 2. COMANDO PARA BUSCAR POR ID DE ROBLOX
    if (command === 'robloxsearch') {
        const robloxId = args[0];

        // Validar que se haya puesto un ID numérico
        if (!robloxId || isNaN(robloxId)) {
            const errorEmbed = new EmbedBuilder()
                .setDescription("❌ Users not founded / doesnt exists")
                .setColor(0xFF0000);
            return message.channel.send({ embeds: [errorEmbed] });
        }

        const url = `https://api.bloxlink.biz/v3/roblox/${robloxId}`;

        try {
            const response = await axios.get(url, {
                headers: { "Authorization": BLOXLINK_API_KEY }
            });

            const discordUsers = response.data.discordUsers || [];
            if (discordUsers.length === 0) throw new Error("No vinculado");

            // Obtenemos al primer usuario para armar el título principal
            const primaryDiscordId = discordUsers[0];
            const primaryUser = await client.users.fetch(primaryDiscordId).catch(() => null);
            const displayTitle = primaryUser ? `${primaryUser.displayName} [${primaryUser.id}]` : `Roblox User [${robloxId}]`;

            // Mapeamos todos los usuarios de Discord vinculados por si la lista se extiende
            const connectedList = discordUsers.map(discordId => `<@${discordId}> [${robloxId}]`).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(displayTitle)
                .setColor(0x0099FF)
                .addFields({
                    name: "Users Connected:",
                    value: connectedList,
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

client.login(process.env.DISCORD_TOKEN);
