require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActivityType } = require('discord.js');
const express = require('express');

// ─────────────────────────────────────────────────────────────────
// 1. SERVIDOR WEB (Para mantener vivo el bot en Render)
// ─────────────────────────────────────────────────────────────────
const app = express();
app.get('/', (req, res) => res.send('Bot online'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Servidor web iniciado'));

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

// ID del canal donde se enviarán los logs de Sapphire
const LOG_CHANNEL_ID = '1498071397136728124';

// ─────────────────────────────────────────────────────────────────
// 3. EVENTO: MENSAJE BORRADO (ESTILO SAPPHIRE PERFECTO)
// ─────────────────────────────────────────────────────────────────
client.on('messageDelete', async (message) => {
    console.log("Evento de borrado detectado en canal:", message.channel.id);
    
    // Filtro base de seguridad
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);

        if (member) {
            const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return console.log("❌ Canal de logs no encontrado.");

            // Timestamp dinámico de Discord para calcular el "hace X tiempo" automáticamente
            const timestampRelativo = Math.floor(message.createdTimestamp / 1000);

            // Construcción del bloque superior de metadatos de Sapphire
            let embedDescription = 
                `**Channel:** ${message.channel.name || 'unknown'} (<#${message.channel.id}>)\n` +
                `**Message ID:** ${message.id}\n` +
                `**Message author:** @${message.author.username} (<@${message.author.id}>)\n` +
                `**Message created:** <t:${timestampRelativo}:R>\n\n` +
                `**Message**\n`;

            // Clonando el sistema de Adjuntos de Sapphire (Si tenía imágenes/archivos)
            if (message.attachments.size > 0) {
                embedDescription += `**${message.attachments.size} Attachment(s)**\n`;
                message.attachments.forEach(attachment => {
                    embedDescription += `> [${attachment.name}](${attachment.url})\n`;
                });
                // Si además de la imagen tenía texto escrito, lo añade abajo
                if (message.content) {
                    embedDescription += `${message.content}`;
                }
            } else {
                // Si solo era texto plano
                embedDescription += message.content ? `${message.content}` : `*Sin contenido de texto*`;
            }

            // Crear el Embed calcado a Sapphire
            const embed = new EmbedBuilder()
                .setColor('#FF0000') // Línea roja lateral característica
                .setTitle('Message deleted')
                .setDescription(embedDescription)
                .setFooter({ 
                    text: `@${message.author.tag}`, 
                    iconURL: message.author.displayAvatarURL({ dynamic: true }) 
                })
                .setTimestamp(); // Muestra el "Today at..." abajo a la derecha del footer

            await logChannel.send({ embeds: [embed] });
            console.log("✅ Embed estilo Sapphire enviado correctamente.");
        }
    } catch (err) {
        console.error('❌ Error en el log de borrado:', err);
    }
});

// ─────────────────────────────────────────────────────────────────
// 4. READY & ACTIVIDAD PERSONALIZADA
// ─────────────────────────────────────────────────────────────────
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} online y aplicando estado.`);
    
    // Tu estado con los emojis exactos configurados como "Jugando"
    client.user.setPresence({
        activities: [{ 
            name: 'Canastas los quiero 🧺 ❤️', 
            type: ActivityType.Playing 
        }],
        status: 'online'
    });
});

// ─────────────────────────────────────────────────────────────────
// 5. LOGIN
// ─────────────────────────────────────────────────────────────────
client.login(process.env.TOKEN);
