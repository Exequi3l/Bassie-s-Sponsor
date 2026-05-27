require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActivityType } = require('discord.js');
const express = require('express');

// ─────────────────────────────────────────────────────────────────
// 1. SERVIDOR WEB (Monitoreo de Salud para Render)
// ─────────────────────────────────────────────────────────────────
const app = express();
const startTime = Date.now();

// Página principal básica
app.get('/', (req, res) => res.send('🤖 Sistema de Logs Operativo 100%'));

// NUEVA FUNCIÓN: Ruta de diagnóstico para ver el estado real del bot desde el navegador
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        uptime: `${Math.round((Date.now() - startTime) / 1000 / 60)} minutos`,
        ping: client.ws.ping ? `${client.ws.ping}ms` : 'calculando...'
    });
});

app.listen(process.env.PORT || 3000, () => {
    console.log('🌐 [SISTEMA] Servidor web de monitoreo iniciado.');
});

// ─────────────────────────────────────────────────────────────────
// 2. CONFIGURACIÓN DEL CLIENTE (Mantenida arriba de todo)
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

// Tus IDs fijos de configuración
const ALLOWED_ROLE_ID = '1498825341718761563';
const LOG_CHANNEL_ID = '1498071397136728124';

// ─────────────────────────────────────────────────────────────────
// 3. EVENTO: MENSAJE BORRADO (Optimizado y con Soporte de Adjuntos)
// ─────────────────────────────────────────────────────────────────
client.on('messageDelete', async (message) => {
    // Log inmediato en la consola de Render para asegurar que el bot "ve" el evento
    console.log(`🗑️ [BORRADO] Evento interceptado en canal ID: ${message.channel.id}`);

    // Si el mensaje es antiguo y no está en caché, los partials evitan el crash pero el autor puede ser null
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        
        // Validación estricta del Rol LARP
        if (member && member.roles.cache.has(ALLOWED_ROLE_ID)) {
            const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return console.log("❌ [ERROR] Canal de logs inaccesible o inexistente.");

            // Formateo exacto estilo bloque ">" solicitado
            let content = message.content 
                ? message.content.split('\n').map(line => `> ${line}`).join('\n') 
                : "> *Sin contenido de texto*";

            // NUEVA FUNCIÓN: Detectar si el mensaje borrado contenía imágenes o archivos
            if (message.attachments.size > 0) {
                const urls = message.attachments.map(a => `[${a.name}](${a.url})`).join(', ');
                content += `\n\n> 📁 **Archivos adjuntos borrados:** ${urls}`;
            }

            const embed = new EmbedBuilder()
                .setColor('#FF0000') // Rojo para borrados
                .setTitle('Message deleted')
                .setDescription(
                    `**Channel:** <#${message.channel.id}>\n` +
                    `**Author:** <@${message.author.id}>\n\n` +
                    `**Content:**\n${content}`
                )
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
            console.log(`✅ [LOG ENVIADO] Mensaje borrado de ${message.author.tag} registrado.`);
        }
    } catch (err) {
        console.error('❌ [ERROR EVENTO DE BORRADO]:', err);
    }
});

// ─────────────────────────────────────────────────────────────────
// 4. NUEVA FUNCIÓN: EVENTO DE MENSAJE EDITADO (Log de Cambios)
// ─────────────────────────────────────────────────────────────────
// Como pediste añadir nuevas funciones, un log de edición es vital junto con el de borrado
client.on('messageUpdate', async (oldMessage, newMessage) => {
    // Si el mensaje viene vacío por falta de caché, intentamos cargarlo de la API
    if (oldMessage.partial) await oldMessage.fetch().catch(() => null);
    if (newMessage.partial) await newMessage.fetch().catch(() => null);

    if (!newMessage.author || newMessage.author.bot || !newMessage.guild) return;
    if (oldMessage.content === newMessage.content) return; // Ignora si solo se cargó un embed o link externo

    try {
        const member = await newMessage.guild.members.fetch(newMessage.author.id).catch(() => null);

        if (member && member.roles.cache.has(ALLOWED_ROLE_ID)) {
            const logChannel = await newMessage.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return;

            const oldContent = oldMessage.content ? oldMessage.content.split('\n').map(line => `> ${line}`).join('\n') : "> *Desconocido (No estaba en memoria)*";
            const newContent = newMessage.content ? newMessage.content.split('\n').map(line => `> ${line}`).join('\n') : "> *Mensaje vacío*";

            const embed = new EmbedBuilder()
                .setColor('#FFA500') // Naranja para ediciones
                .setTitle('Message edited')
                .setDescription(
                    `**Channel:** <#${newMessage.channel.id}>\n` +
                    `**Author:** <@${newMessage.author.id}>\n` +
                    `**[Ir al Mensaje original](${newMessage.url})**\n\n` +
                    `**Before:**\n${oldContent}\n\n` +
                    `**After:**\n${newContent}`
                )
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
            console.log(`✅ [LOG ENVIADO] Edición de ${newMessage.author.tag} registrada.`);
        }
    } catch (err) {
        console.error('❌ [ERROR EVENTO DE EDICIÓN]:', err);
    }
});

// ─────────────────────────────────────────────────────────────────
// 5. INICIALIZACIÓN Y ANTICRASH GLOBAL
// ─────────────────────────────────────────────────────────────────
client.once('ready', () => {
    console.log(`✅ [BOT] Autenticado como ${client.user.tag}`);
    
    // Nueva función estética: Coloca un estado personalizado al Bot en Discord
    client.user.setPresence({
        activities: [{ name: 'los registros del servidor 👁️', type: ActivityType.Watching }],
        status: 'online'
    });
});

// Sistema anti-crash para que Render no tire el bot si ocurre un error inesperado de red
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 [ANTICRASH] Rechazo no manejado en:', promise, 'razón:', reason);
});

client.login(process.env.TOKEN);
