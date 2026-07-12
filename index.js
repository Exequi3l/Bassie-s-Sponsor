const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const http = require('http');
require('dotenv').config();

// === VINCULACIÓN DEL PUERTO (Para Render) ===
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot online e operativo.');
}).listen(PORT, () => {
    console.log(`Servidor web escuchando en el puerto ${PORT}`);
});
// ============================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = "!";

// Tu API Key de prueba asignada por defecto
const BLOXLINK_API_KEY = process.env.BLOXLINK_API_KEY || "785d27c1-04a6-4685-9482-c29643e05def";

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 🔍 1. COMANDO DISCORDSEARCH
    if (command === 'discordsearch') {
        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);

        if (!targetUser) {
            const errorEmbed = new EmbedBuilder()
                .setDescription("❌ Error: No se pudo encontrar a ese usuario en Discord. Verifica el ID o la mención.")
                .setColor(0xFF0000);
            return message.channel.send({ embeds: [errorEmbed] });
        }

        const url = `https://api.bloxlink.biz/v3/user/${targetUser.id}`;

        try {
            const response = await axios.get(url, {
                headers: { "Authorization": BLOXLINK_API_KEY }
            });

            const robloxId = response.data.robloxId;
            if (!robloxId) throw new Error("NOT_LINKED");

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
            let errorText = "❌ Users not founded / doesnt exists";

            // Diagnóstico detallado del error de la API
            if (error.response) {
                if (error.response.status === 401 || error.response.status === 403) {
                    errorText = `🔑 **Bloxlink Error (${error.response.status}):** La API Key de prueba es inválida, expiró o no pertenece a este servidor.`;
                } else if (error.response.status === 404) {
                    errorText = "❌ Users not founded / doesnt exists (Este Discord no está vinculado en Bloxlink)";
                } else {
                    errorText = `⚠️ **Bloxlink Error (${error.response.status}):** ${error.response.data?.error || error.message}`;
                }
            } else if (error.message === "NOT_LINKED") {
                errorText = "❌ Users not founded / doesnt exists (Cuenta sin ID de Roblox asociado)";
            } else {
                errorText = `💻 **Internal Error:** ${error.message}`;
            }

            const errorEmbed = new EmbedBuilder().setDescription(errorText).setColor(0xFF0000);
            await message.channel.send({ embeds: [errorEmbed] });
        }
    }

    // 🔍 2. COMANDO ROBLOXSEARCH
    if (command === 'robloxsearch') {
        const robloxId = args[0];

        if (!robloxId || isNaN(robloxId)) {
            const errorEmbed = new EmbedBuilder()
                .setDescription("❌ Por favor, provee un ID de Roblox puramente numérico.")
                .setColor(0xFF0000);
            return message.channel.send({ embeds: [errorEmbed] });
        }

        const url = `https://api.bloxlink.biz/v3/roblox/${robloxId}`;

        try {
            const response = await axios.get(url, {
                headers: { "Authorization": BLOXLINK_API_KEY }
            });

            const discordUsers = response.data.discordUsers || [];
            if (discordUsers.length === 0) throw new Error("NOT_LINKED");

            const primaryDiscordId = discordUsers[0];
            const primaryUser = await client.users.fetch(primaryDiscordId).catch(() => null);
            const displayTitle = primaryUser ? `${primaryUser.displayName} [${primaryUser.id}]` : `Roblox User [${robloxId}]`;

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
            let errorText = "❌ Users not founded / doesnt exists";

            if (error.response) {
                if (error.response.status === 401 || error.response.status === 403) {
                    errorText = `🔑 **Bloxlink Error (${error.response.status}):** La API Key de prueba es inválida, expiró o no tiene accesos.`;
                } else if (error.response.status === 404) {
                    errorText = "❌ Users not founded / doesnt exists (Este ID de Roblox no está en los registros de Bloxlink)";
                } else {
                    errorText = `⚠️ **Bloxlink Error (${error.response.status}):** ${error.response.data?.error || error.message}`;
                }
            } else if (error.message === "NOT_LINKED") {
                errorText = "❌ Users not founded / doesnt exists (Este ID de Roblox no tiene Discords conectados)";
            } else {
                errorText = `💻 **Internal Error:** ${error.message}`;
            }

            const errorEmbed = new EmbedBuilder().setDescription(errorText).setColor(0xFF0000);
            await message.channel.send({ embeds: [errorEmbed] });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
