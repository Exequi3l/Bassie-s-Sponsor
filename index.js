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
        GatewayIntentBits.GuildModeration // Para leer quién borró el mensaje
    ],
    partials: [Partials.Message, Partials.Channel]
});

// NUEVOS IDs ACTUALIZADOS
const LOG_CHANNEL_ID = '1508962801518121060';
const ALLOWED_ROLE_ID = '1458309307677540453';

// ─────────────────────────────────────────────────────────────────
// 3. EVENTO: MENSAJE BORRADO (CON FILTRO DE ROL)
// ─────────────────────────────────────────────────────────────────
client.on('messageDelete', async (message) => {
    // Evitamos errores básicos y omitimos bots
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        // Buscamos al miembro en el servidor para leer sus roles
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);

        // 🛡️ FILTRO DE ROL: Si no tiene el rol permitido, el bot ignora el borrado
        if (!member || !member.roles.cache.has(ALLOWED_ROLE_ID)) return;

        const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel) return console.log("❌ Canal de logs no encontrado.");

        // -------------------------------------------------------------
        // BÚSQUEDA EN AUDITORÍA PARA SABER QUIÉN LO BORRÓ
        // -------------------------------------------------------------
        let executor = message.author; // Por defecto es el propio autor

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
        // -------------------------------------------------------------

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
        console.log(`✅ Log de borrado enviado al canal ${LOG_CHANNEL_ID}.`);

    } catch (err) {
        console.error('❌ Error en el log de borrado:', err);
    }
});

// ─────────────────────────────────────────────────────────────────
// 4. READY Y ACTIVIDAD
// ─────────────────────────────────────────────────────────────────
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} encendido correctamente y monitoreando el rol.`);
    
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
