require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const express = require('express');

// ─────────────────────────────
// SERVIDOR WEB (Para mantener el bot online en Render)
// ─────────────────────────────
const app = express();
app.get('/', (req, res) => res.send('Bot online'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Servidor web iniciado'));

// ─────────────────────────────
// CONFIGURACIÓN DEL CLIENTE
// ─────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel] 
});

// IDs configurados según tu petición
const ALLOWED_ROLE_ID = '1498825341718761563'; 
const LOG_CHANNEL_ID = '1498071397136728124';

// ─────────────────────────────
// EVENTO: MENSAJE BORRADO
// ─────────────────────────────
client.on('messageDelete', async (message) => {
    // Debug: Esto aparecerá en los logs de Render para saber si el bot "ve" el borrado
    console.log("Evento de borrado detectado en canal:", message.channel.id);
    
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        
        // Verificación del rol específico
        if (member && member.roles.cache.has(ALLOWED_ROLE_ID)) {
            const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return;

            const content = message.content 
                ? message.content.split('\n').map(line => `> ${line}`).join('\n') 
                : "> *Sin contenido*";

            const embed = new EmbedBuilder()
                .setColor('#FF0000') // Rojo
                .setTitle('Message deleted')
                .setDescription(
                    `**Channel:** <#${message.channel.id}>\n` +
                    `**Author:** <@${message.author.id}>\n\n` +
                    `**Content:**\n${content}`
                )
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('❌ Error en log de borrado:', err);
    }
});

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} online. Vigilando borrados para el rol LARP.`);
});

client.login(process.env.TOKEN);
