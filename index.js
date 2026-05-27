require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const express = require('express');

// Servidor Express
const app = express();
app.get('/', (req, res) => res.send('Bot online'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Servidor web iniciado'));

// Definición del Cliente
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
});

const ALLOWED_ROLE_ID = '1498825341718761563';
const LOG_CHANNEL_ID = '1498071397136728124';

// Evento de borrado con Diagnóstico de Roles
client.on('messageDelete', async (message) => {
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        
        if (member) {
            // DIAGNÓSTICO: Esto te dirá en los logs qué roles tiene el usuario
            const rolesList = member.roles.cache.map(r => `${r.name}: ${r.id}`).join(', ');
            console.log(`DEBUG: Usuario ${message.author.tag} borró mensaje. Roles encontrados: ${rolesList}`);

            if (member.roles.cache.has(ALLOWED_ROLE_ID)) {
                const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (!logChannel) return console.log("❌ Canal de logs no encontrado.");

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
                console.log("✅ Embed enviado exitosamente.");
            } else {
                console.log(`ℹ️ Borrado ignorado: El usuario no tiene el rol ID ${ALLOWED_ROLE_ID}.`);
            }
        }
    } catch (err) {
        console.error('❌ Error general:', err);
    }
});

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} online y vigilando.`);
});

client.login(process.env.TOKEN);
