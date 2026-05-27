require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActivityType, AuditLogEvent } = require('discord.js');
const express = require('express');

// ─────────────────────────────────────────────────────────────────
// 1. SERVIDOR WEB (Para Render y UptimeRobot)
// ─────────────────────────────────────────────────────────────────
const app = express();
app.get('/', (req, res) => res.send('Bot Sapphire-Logs Online'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Servidor web operativo'));

// ─────────────────────────────────────────────────────────────────
// 2. CONFIGURACIÓN DEL CLIENTE
// ─────────────────────────────────────────────────────────────────
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

// SOLO EL NUEVO CANAL DE LOGS (Sin filtro de rol)
const LOG_CHANNEL_ID = '1508962801518121060';

// ─────────────────────────────────────────────────────────────────
// 3. EVENTO: MENSAJE BORRADO
// ─────────────────────────────────────────────────────────────────
client.on('messageDelete', async (message) => {
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel) return console.log("❌ Canal de logs no encontrado.");

        // BÚSQUEDA EN AUDITORÍA PARA SABER QUIÉN LO BORRÓ
        let executor = message.author; 

        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            const fetchedLogs = await message.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MessageDelete,
            });
            
            const deletionLog = fetchedLogs.entries.first();

            if (deletionLog) {
                const { executor: logExecutor, target, createdTimestamp } = deletionLog;
                if (target.id === message.author.id && createdTimestamp > (Date.now() - 5000)) {
                    executor = logExecutor; 
                }
            }
        } catch (auditError) {
            console.log("⚠️ No se pudo acceder a los Audit Logs.");
        }

        const timestampRelativo = Math.floor(message.createdTimestamp / 1000);

        let embedDescription = 
            `**Channel:** ${message.channel.name || 'unknown'} (<#${message.channel.id}>)\n` +
            `**Message ID:** ${message.id}\n` +
            `**Message author:** @${message.author.username} (<@${message.author.id}>)\n` +
            `**Message created:** <t:${timestampRelativo}:R>\n\n` +
            `**Message**\n`;

        if (message.attachments.size > 0) {
            embedDescription += `**${message.attachments.size} Attachment(s)**\n`;
            message.attachments.forEach(attachment => {
                embedDescription += `> [${attachment.name}](${attachment.url})\n`;
            });
            if (message.content) embedDescription += `${message.content}`;
        } else {
            embedDescription += message.content ? `${message.content}` : `*Sin contenido de texto*`;
        }

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Message deleted')
            .setDescription(embedDescription)
            .setFooter({ 
                text: `@${executor.username}`, 
                iconURL: executor.displayAvatarURL({ dynamic: true }) 
            })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
        console.log(`✅ Log de borrado enviado al nuevo canal.`);

    } catch (err) {
        console.error('❌ Error en el log de borrado:', err);
    }
});

// ─────────────────────────────────────────────────────────────────
// 4. READY Y ACTIVIDAD
// ─────────────────────────────────────────────────────────────────
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} encendido correctamente.`);
    
    client.user.setPresence({
        activities: [{ 
            name: 'Canastas los quiero 🧺 ❤️', 
            type: ActivityType.Playing 
        }],
        status: 'online'
    });
});

process.on('unhandledRejection', (reason) => console.error('💥 Error no controlado:', reason));

client.login(process.env.TOKEN);
