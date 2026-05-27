require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActivityType, AuditLogEvent } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Message, Partials.Channel]
});

const LOG_CHANNEL_ID = '1508962801518121060';
const ALLOWED_ROLE_ID = '1458309307677540453';

// Mapa para evitar duplicados en tiempo real (evita que el bot procese el mismo evento dos veces)
const processedMessages = new Set();

client.on('messageDelete', async (message) => {
    if (!message.author || message.author.bot || !message.guild) return;
    
    // Filtro anti-duplicados por ID de mensaje
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 5000);

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        
        // FILTRO DE ROL
        if (!member || !member.roles.cache.has(ALLOWED_ROLE_ID)) return;

        const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel) return;

        let executor = message.author;
        await new Promise(resolve => setTimeout(resolve, 1200));

        try {
            const fetchedLogs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
            const deletionLog = fetchedLogs.entries.first();
            if (deletionLog && deletionLog.target.id === message.author.id && deletionLog.createdTimestamp > (Date.now() - 5000)) {
                executor = deletionLog.executor;
            }
        } catch (e) { /* Fallback a autor */ }

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Message deleted')
            .setDescription(
                `**Channel:** <#${message.channel.id}>\n` +
                `**Message ID:** ${message.id}\n` +
                `**Message author:** @${message.author.username} (<@${message.author.id}>)\n` +
                `**Message created:** <t:${Math.floor(message.createdTimestamp / 1000)}:R>\n\n` +
                `**Message**\n${message.content || '*Sin contenido*'}`
            )
            .setFooter({ text: `@${executor.username}`, iconURL: executor.displayAvatarURL() })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error(err);
    }
});

client.once('ready', () => {
    client.user.setPresence({ activities: [{ name: 'Canastas los quiero 🧺 ❤️', type: ActivityType.Playing }], status: 'online' });
    console.log("✅ Bot listo y filtrando por rol.");
});

client.login(process.env.TOKEN);
