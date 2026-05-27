require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, AuditLogEvent } = require('discord.js');
const express = require('express');

// Servidor para mantener al bot despierto (Render)
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel]
});

const LOG_CHANNEL_ID = '1508962801518121060';
const MOD_ROLE_ID = '1458309307677540453';
const processedMessages = new Set(); // Anti-duplicados

client.on('messageDelete', async (message) => {
    if (!message.guild || message.author?.bot) return;

    // 1. Evitar que se procese el mismo mensaje dos veces
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 5000);

    try {
        // 2. Intentar buscar al ejecutor en el Audit Log
        let executor = null;
        try {
            const logs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
            const entry = logs.entries.first();
            if (entry && entry.target.id === message.author.id && (Date.now() - entry.createdTimestamp) < 10000) {
                executor = entry.executor;
            }
        } catch (e) { console.log("Audit log inaccesible"); }

        if (!executor) executor = message.author;

        // 3. Verificar si el ejecutor tiene el ROL
        const member = await message.guild.members.fetch(executor.id).catch(() => null);
        if (!member || !member.roles.cache.has(MOD_ROLE_ID)) {
            console.log(`Log ignorado: @${executor.username} no tiene el rol.`);
            return;
        }

        // 4. Enviar Embed
        const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Message Deleted')
                .setDescription(
                    `**Channel:** <#${message.channel.id}>\n` +
                    `**Author:** <@${message.author.id}>\n` +
                    `**Deleted by:** <@${executor.id}>\n` +
                    `**Content:** ${message.content || '*Sin texto*'}`
                )
                .setFooter({ text: `@${executor.username}`, iconURL: executor.displayAvatarURL() })
                .setTimestamp();
            
            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error("Error final:", err);
    }
});

client.login(process.env.TOKEN);
