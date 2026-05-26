require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const express = require('express');

// ─────────────────────────────
// CONFIGURACIÓN BÁSICA
// ─────────────────────────────
const app = express();
app.get('/', (req, res) => res.send('Bot online'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Servidor web iniciado'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel] // Vital para borrar mensajes
});

const ALLOWED_ROLE_ID = '1372698992239968326'; 
const SAPPHIRE_LOG_CHANNEL = '1406751369401991258';

// ─────────────────────────────
// EVENTO: MENSAJE BORRADO (LOGS ESPECÍFICOS)
// ─────────────────────────────
client.on('messageDelete', async (message) => {
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        
        // Solo registra si el usuario tiene tu rol específico
        if (member && member.roles.cache.has(ALLOWED_ROLE_ID)) {
            const logChannel = await message.guild.channels.fetch(SAPPHIRE_LOG_CHANNEL).catch(() => null);
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

// ─────────────────────────────
// (AQUÍ IRÍA TU LÓGICA DE JOIN/LEAVE Y COMANDOS)
// ... puedes pegar aquí el resto de tu lógica anterior ...
// ─────────────────────────────

client.login(process.env.TOKEN);
