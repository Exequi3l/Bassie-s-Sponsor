require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, AuditLogEvent } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMembers // OBLIGATORIO para leer roles
    ],
    partials: [Partials.Message, Partials.Channel]
});

const LOG_CHANNEL_ID = '1508962801518121060';
const MOD_ROLE_ID = '1458309307677540453';

client.on('messageDelete', async (message) => {
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        // --- BLOQUE 1: IDENTIFICAR EJECUTOR ---
        let executor = message.author;
        await new Promise(r => setTimeout(r, 1200)); 

        try {
            const logs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
            const entry = logs.entries.first();
            if (entry && entry.target.id === message.author.id && entry.createdTimestamp > (Date.now() - 5000)) {
                executor = entry.executor;
            }
        } catch (e) { console.log("No pude leer logs, usando autor."); }

        // --- BLOQUE 2: VERIFICACIÓN DE ROL ---
        const member = await message.guild.members.fetch(executor.id).catch(() => null);
        
        // Aquí está el filtro: Si no existe el miembro o no tiene el rol, salimos
        if (!member) {
            console.log("No se pudo fetch al miembro.");
            return;
        }

        if (!member.roles.cache.has(MOD_ROLE_ID)) {
            console.log(`El usuario ${executor.username} no tiene el rol de moderador.`);
            return;
        }

        // --- BLOQUE 3: ENVÍO DEL EMBED (Solo si pasó el filtro) ---
        const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Message deleted')
            .setDescription(
                `**Channel:** <#${message.channel.id}>\n` +
                `**Author:** <@${message.author.id}>\n` +
                `**Deleted by:** <@${executor.id}>\n` +
                `**Content:** ${message.content || '*Sin texto*'}`
            )
            .setFooter({ text: `@${executor.username}`, iconURL: executor.displayAvatarURL() })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
        console.log("✅ Embed enviado correctamente.");

    } catch (err) {
        console.error("Error crítico:", err);
    }
});

client.login(process.env.TOKEN);
