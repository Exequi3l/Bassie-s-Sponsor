require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const express = require('express');

const app = express();
app.listen(process.env.PORT || 3000, () => console.log('🌐 Servidor web iniciado'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
});

// --- CHIVATO DE CONEXIÓN ---
client.on('messageCreate', (message) => {
    console.log(`💬 Mensaje detectado: "${message.content}" en canal ${message.channel.id}`);
});

// --- LOG DE BORRADO ---
client.on('messageDelete', async (message) => {
    console.log(`🗑️ Evento de borrado detectado en canal: ${message.channel.id}`);
    
    if (!message.author || message.author.bot) return;

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        
        // ID de tu ROL: 1498825341718761563
        if (member && member.roles.cache.has('1498825341718761563')) {
            const logChannel = await message.guild.channels.fetch('1498071397136728124').catch(() => null);
            
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('Message deleted')
                    .setDescription(`**Author:** <@${message.author.id}>\n**Content:** ${message.content || 'Sin contenido'}`);
                
                await logChannel.send({ embeds: [embed] });
                console.log("✅ Log enviado con éxito a Discord.");
            } else {
                console.log("❌ No pude encontrar el canal de logs para enviar el mensaje.");
            }
        } else {
            console.log("ℹ️ Borrado ignorado: Usuario sin el rol requerido o no encontrado.");
        }
    } catch (err) {
        console.error("❌ Error grave en messageDelete:", err);
    }
});

client.once('ready', () => console.log(`✅ ${client.user.tag} conectado.`));
client.login(process.env.TOKEN);
