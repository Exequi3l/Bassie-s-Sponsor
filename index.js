const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const http = require('http');
require('dotenv').config();

// === VINCULACIÓN DEL PUERTO (Para mantener vivo el bot en Render) ===
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

// El bot buscará la KEY en tus variables de entorno de Render, o usará la que pegues aquí abajo
const BLOXLINK_API_KEY = process.env.BLOXLINK_API_KEY || "8fe9f751-9316-4fe1-82f7-2438e97db65a";

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 🔍 1. BUSCAR POR DISCORD (Mención o ID de Discord)
    if (command === 'discordsearch') {
        // Alerta si olvidaste cambiar la clave de la API
        if (BLOXLINK_API_KEY === "TU_API_KEY_DE_BLOXLINK_AQUÍ") {
            return message.reply("⚠️ **Error de configuración:** No has colocado tu API Key de Bloxlink en el código o en las variables de entorno.");
        }

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
            // Si la API de Bloxlink dice que tu clave es inválida (Error 401 o 403)
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                return message.reply("🔑 **Error de Bloxlink:** Tu API Key es inválida, no tiene permisos o ha expirado.");
            }

            const errorEmbed = new EmbedBuilder()
                .setDescription("❌ Users not founded / doesnt exists")
                .setColor(0xFF0000);
            await message.channel.send({ embeds: [errorEmbed] });
        }
    }

    // 🔍 2. BUSCAR POR ID DE ROBLOX
    if (command === 'robloxsearch') {
        if (BLOXLINK_API_KEY === "8fe9f751-9316-4fe1-82f7-2438e97db65a") {
            return message.reply("⚠️ **Error de configuración:** No has colocado tu API Key de Bloxlink en el código o en las variables de entorno.");
        }

        const robloxId = args[0];

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

            // Obtenemos los datos del primer Discord vinculado para armar el título principal
            const primaryDiscordId = discordUsers[0];
            const primaryUser = await client.users.fetch(primaryDiscordId).catch(() => null);
            const displayTitle = primaryUser ? `${primaryUser.displayName} [${primaryUser.id}]` : `Roblox User [${robloxId}]`;

            // Construir la lista extendida si hay múltiples cuentas conectadas
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
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                return message.reply("🔑 **Error de Bloxlink:** Tu API Key es inválida, no tiene permisos o ha expirado.");
            }

            const errorEmbed = new EmbedBuilder()
                .setDescription("❌ Users not founded / doesnt exists")
                .setColor(0xFF0000);
            await message.channel.send({ embeds: [errorEmbed] });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
