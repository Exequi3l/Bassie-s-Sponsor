require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActivityType, AuditLogEvent } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Message, Partials.Channel]
});

const LOG_CHANNEL_ID = '1508962801518121060';
const MOD_ROLE_ID = '1458309307677540453'; // Tu rol de moderación

client.on('messageDelete', async (message) => {
    if (!message.author || message.author.bot) return;

    try {
        const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel) return;

        // 1. Intentar identificar quién borró el mensaje
        let executor = message.author; // Por defecto asumimos que fue el autor
        await new Promise(r => setTimeout(r, 1000)); // Espera necesaria para el log de auditoría

        try {
            const logs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
            const entry = logs.entries.first();
            
            // Si el borrado fue reciente y corresponde al mensaje
            if (entry && entry.target.id === message.author.id && entry.createdTimestamp > (Date.now() - 5000)) {
                executor = entry.executor;
            }
        } catch (e) {
            console.log("No pude leer auditoría, usando autor.");
        }

        // 2. FILTRO DE ROL: Verificar si el ejecutor tiene el rol de moderador
        const executorMember = await message.guild.members.fetch(executor.id).catch(() => null);
        const hasPermission = executorMember && executorMember.roles.cache.has(MOD_ROLE_ID);

        // Si el ejecutor no tiene el rol, NO enviamos el log
        if (!hasPermission) return;

        // 3. Si tiene el rol, enviamos el embed
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Message deleted')
            .setDescription(
                `**Channel:** <#${message.channel.id}>\n` +
                `**Message ID:** ${message.id}\n` +
                `**Author:** <@${message.author.id}>\n` +
                `**Deleted by:** <@${executor.id}>\n` + // Aquí mostramos al moderador
                `**Content:** ${message.content || '*Sin texto*'}`
            )
            .setFooter({ text: `@${executor.username}`, iconURL: executor.displayAvatarURL() })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("Error:", err);
    }
});

client.login(process.env.TOKEN);
