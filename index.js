require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActivityType } = require('discord.js');
const express = require('express');

// ─────────────────────────────────────────────────────────────────
// 1. SERVIDOR WEB (Para Render)
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
    partials: [Partials.Message, Partials.Channel] // IMPORTANTE para logs de borrado
});

// Tu canal de destino para los embeds
const LOG_CHANNEL_ID = '1498071397136728124';

// ─────────────────────────────────────────────────────────────────
// 3. EVENTO: MENSAJE BORRADO
// ─────────────────────────────────────────────────────────────────
client.on('messageDelete', async (message) => {
    console.log("Evento de borrado detectado en canal:", message.channel.id);
    
    // Ignorar bots y asegurarse de tener los datos mínimos
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);

        // Dejamos la condición limpia que te funcionó (sin restricción de rol)
        if (member) {
            const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return console.log("❌ Canal de logs no encontrado.");

            // Formateo del bloque con ">" línea por línea
            const content = message.content 
                ? message.content.split('\n').map(line => `> ${line}`).join('\n') 
                : "> *Sin contenido o mensaje antiguo*";

            // Estructura limpia e idéntica a tus referencias
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
        }
    } catch (err) {
        console.error('❌ Error en el log de borrado:', err);
    }
});

// ─────────────────────────────────────────────────────────────────
// 4. READY CON TU NUEVO ESTADO PERSONALIZADO
// ─────────────────────────────────────────────────────────────────
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} conectado y aplicando estado.`);
    
    // Configuración exacta de tu actividad con emojis
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
