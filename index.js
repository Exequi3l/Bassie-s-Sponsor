require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const express = require('express');

// ─────────────────────────────
// CONFIGURACIÓN WEB (Para Render)
// ─────────────────────────────
const app = express();
app.get('/', (req, res) => res.send('Bot online'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Servidor web iniciado'));

// ─────────────────────────────
// CLIENTE Y INTENTS
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
// LOG DE BORRADOS
// ─────────────────────────────
client.on('messageDelete', async (message) => {
    // Seguridad: Ignorar bots y mensajes sin autor
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        
        // Filtrar por tu rol específico
        if (member && member.roles.cache.has(ALLOWED_ROLE_ID)) {
            const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return;

            // Formateo con ">" línea por línea
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
    console.log(`✅ ${client.user.tag} online y listo para vigilar.`);
});

client.login(process.env.TOKEN);
