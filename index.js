require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActivityType } = require('discord.js');
const express = require('express');

// ─────────────────────────────────────────────────────────────────
// 1. SERVIDOR WEB (Para mantener el bot vivo 24/7 en Render)
// ─────────────────────────────────────────────────────────────────
const app = express();
app.get('/', (req, res) => res.send('🤖 Bot de Logs Operativo 100%'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Servidor web iniciado con éxito.'));

// ─────────────────────────────────────────────────────────────────
// 2. CONFIGURACIÓN DEL CLIENTE (Definido arriba para evitar errores)
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

// Tus configuraciones de IDs fijas
const ALLOWED_ROLE_ID = '1498825341718761563';
const LOG_CHANNEL_ID = '1498071397136728124';

// ─────────────────────────────────────────────────────────────────
// 3. EVENTO: READY (Inicio del Bot y Estado Personalizado)
// ─────────────────────────────────────────────────────────────────
client.once('ready', () => {
    console.log(`✅ [BOT] Autenticado e iniciado como ${client.user.tag}`);
    
    // Tu actividad personalizada con los emojis solicitados
    client.user.setPresence({
        activities: [{ 
            name: 'Canastas los quiero 🧺 ❤️', 
            type: ActivityType.Playing 
        }],
        status: 'online'
    });
});

// ─────────────────────────────────────────────────────────────────
// 4. EVENTO: MENSAJE BORRADO (Formato de Estilo de Referencia)
// ─────────────────────────────────────────────────────────────────
client.on('messageDelete', async (message) => {
    // Si el mensaje es viejo y no estaba en la caché del bot, no se puede leer autor ni contenido
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        
        // Validación del rol específico
        if (member && member.roles.cache.has(ALLOWED_ROLE_ID)) {
            const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return console.log("❌ Canal de logs no encontrado en Discord.");

            // Formateo del bloque de texto usando "> " línea por línea
            const content = message.content 
                ? message.content.split('\n').map(line => `> ${line}`).join('\n') 
                : "> *Sin contenido de texto (o era un archivo/imagen)*";

            // Estructura visual idéntica a tu captura de pantalla
            const embed = new EmbedBuilder()
                .setColor('#FF0000') // Color rojo de advertencia
                .setTitle('Message deleted')
                .setDescription(
                    `**Channel:** <#${message.channel.id}>\n` +
                    `**Author:** <@${message.author.id}>\n\n` +
                    `**Content:**\n${content}`
                )
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
            console.log(`✅ Log de borrado enviado para el usuario: ${message.author.tag}`);
        }
    } catch (err) {
        console.error('❌ Error detectado en el evento de borrado:', err);
    }
});

// ─────────────────────────────────────────────────────────────────
// 5. SISTEMA DE PROTECCIÓN ANTICRASH GLOBAL
// ─────────────────────────────────────────────────────────────────
// Esto evita que Render te apague el bot si ocurre un error inesperado de la API de Discord
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 [ANTICRASH] Rechazo no manejado en promesa:', promise, 'Razón:', reason);
});

process.on('uncaughtException', (err, origin) => {
    console.error('💥 [ANTICRASH] Excepción no capturada en:', origin, 'Error:', err);
});

// Conexión final usando la variable de entorno de tu archivo .env o de Render
client.login(process.env.TOKEN);
