require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActivityType } = require('discord.js');
const express = require('express');

// ─────────────────────────────────────────────────────────────────
// 1. SERVIDOR WEB (Para Render)
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
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
});

// Canal de destino único para tus logs
const LOG_CHANNEL_ID = '1498071397136728124';

// ─────────────────────────────────────────────────────────────────
// 3. EVENTO: MENSAJE BORRADO (ESTILO SAPPHIRE)
// ─────────────────────────────────────────────────────────────────
client.on('messageDelete', async (message) => {
    // Filtro para evitar errores si el mensaje es antiguo o es de un bot
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel) return console.log("❌ Canal de logs no encontrado.");

        // Genera el tiempo relativo dinámico (ej: "hace 5 minutos")
        const timestampRelativo = Math.floor(message.createdTimestamp / 1000);

        // Estructura idéntica a Sapphire
        let embedDescription = 
            `**Channel:** ${message.channel.name || 'unknown'} (<#${message.channel.id}>)\n` +
            `**Message ID:** ${message.id}\n` +
            `**Message author:** @${message.author.username} (<@${message.author.id}>)\n` +
            `**Message created:** <t:${timestampRelativo}:R>\n\n` +
            `**Message**\n`;

        // Soporte para imágenes o archivos adjuntos borrados
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
                text: `@${message.author.username}`, 
                iconURL: message.author.displayAvatarURL({ dynamic: true }) 
            })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
        console.log(`✅ Log enviado para el mensaje de @${message.author.username}`);

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

// Evita caídas por errores externos de conexión
process.on('unhandledRejection', (reason) => console.error('💥 Error no controlado:', reason));

client.login(process.env.TOKEN);
