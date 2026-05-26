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

const ALLOWED_ROLE_ID = '1372698992239968326'; 
const LOG_CHANNEL_ID = '1406751369401991258';

// ─────────────────────────────
// EVENTO: MENSAJE BORRADO
// ─────────────────────────────
client.on('messageDelete', async (message) => {
    // Debug: Esto aparecerá en los logs de Render
    console.log("Evento de borrado detectado en canal:", message.channel.id);
    
    // Ignorar bots y mensajes sin autor o guild
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        
        // Verificación de rol
        if (member && member.roles.cache.has(ALLOWED_ROLE_ID)) {
            const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return;

            const content = message.content 
                ? message.content.split('\n').map(line => `> ${line}`).join('\n') 
                : "> *Sin contenido*";

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
        }
    } catch (err) {
        console.error('❌ Error en log de borrado:', err);
    }
});

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} online. Vigilando borrados para el rol ${ALLOWED_ROLE_ID}`);
});

client.login(process.env.TOKEN);
