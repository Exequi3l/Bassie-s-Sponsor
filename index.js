require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActivityType } = require('discord.js');
const express = require('express');

// ─────────────────────────────────────────────────────────────────
// 1. SERVIDOR WEB (Para Render)
// ─────────────────────────────────────────────────────────────────
const app = express();
app.get('/', (req, res) => res.send('🤖 Bot Online'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Servidor web iniciado.'));

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
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

// Tus configuraciones fijas de IDs
const ALLOWED_ROLE_ID = '1498825341718761563';
const LOG_CHANNEL_ID = '1498071397136728124';

// ─────────────────────────────────────────────────────────────────
// 3. EVENTO: MENSAJE BORRADO (Diseño Final)
// ─────────────────────────────────────────────────────────────────
client.on('messageDelete', async (message) => {
    // Si el mensaje no estaba en la memoria caché (mensajes viejos), no se puede obtener el autor o contenido
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        
        // Verificación de tu rol específico
        if (member && member.roles.cache.has(ALLOWED_ROLE_ID)) {
            const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return console.log("❌ Canal de logs no encontrado.");

            // Formateo del bloque de texto con ">"
            const content = message.content 
                ? message.content.split('\n').map(line => `> ${line}`).join('\n') 
                : "> *Sin contenido de texto / Archivo adjunto*";

            // Estructura idéntica a tu referencia
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
            console.log(`✅ Log de borrado enviado para: ${message.author.tag}`);
        }
    } catch (err) {
        console.error('❌ Error en el evento de borrado:', err);
    }
});

// ─────────────────────────────────────────────────────────────────
// 4. INICIALIZACIÓN Y ESTADO PERSONALIZADO
// ─────────────────────────────────────────────────────────────────
client.once('ready', () => {
    console.log(`✅ [BOT] ${client.user.tag} operativo.`);
    
    // Configuración de la actividad solicitada
    client.user.setPresence({
        activities: [{ 
            name: 'Canastas los quiero 🧺 ❤️', 
            type: ActivityType.Playing 
        }],
        status: 'online'
    });
});

// Sistema anti-crash para evitar que Render apague el bot por errores de conexión externos
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 [ANTICRASH] Error no controlado:', reason);
});

client.login(process.env.TOKEN);
