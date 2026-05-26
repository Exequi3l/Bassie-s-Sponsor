require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const express = require('express');

// ─────────────────────────────
// SERVIDOR WEB (Para Render)
// ─────────────────────────────
const app = express();
app.get('/', (req, res) => res.send('Bot online'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Servidor web iniciado'));

// ─────────────────────────────
// CLIENTE Y CONFIGURACIÓN
// ─────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel] // IMPORTANTE para logs de borrado
});

const ALLOWED_ROLE_ID = '1498825341718761563'; 
const LOG_CHANNEL_ID = '1498071397136728124';

// ─────────────────────────────
// EVENTO: MENSAJE BORRADO
// ─────────────────────────────
client.on('messageDelete', async (message) => {
    // Debug para consola de Render
    console.log("Evento de borrado detectado en canal:", message.channel.id);
    
    // Ignorar bots y asegurarse de que tenemos guild
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        
        // Verificación de rol y envío de log
        if (member && member.roles.cache.has(ALLOWED_ROLE_ID)) {
            const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return console.log("❌ Canal de logs no encontrado.");

            const content = message.content 
                ? message.content.split('\n').map(line => `> ${line}`).join('\n') 
                : "> *Sin contenido o mensaje antiguo*";

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Message deleted')
                .setDescription(
                    `**Channel:** <#${message.channel.id}>\n` +
                    `**Author:** <@${message.author.id}>\n\n` +
                    `**Content:**\n${content}`
                )
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
            console.log("✅ Embed enviado exitosamente al canal de logs.");
        } else {
            console.log("ℹ️ Borrado ignorado: Usuario no tiene el rol especificado.");
        }
    } catch (err) {
        console.error('❌ Error en el log de borrado:', err);
    }
});

// ─────────────────────────────
// READY
// ─────────────────────────────
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} online y vigilando.`);
});

// Login final usando el token de las variables de entorno
client.login(process.env.TOKEN);
