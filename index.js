require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const express = require('express');

// 1. Servidor Express (Esto va primero)
const app = express();
app.get('/', (req, res) => res.send('Bot online'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Servidor web iniciado'));

// 2. CREACIÓN DEL CLIENTE (Aquí se define 'client', por eso fallaba)
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

// 3. EVENTO DE BORRADO
client.on('messageDelete', async (message) => {
    if (!message.author || message.author.bot || !message.guild) return;

    try {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        
        // QUITAMOS FILTRO PARA PROBAR (Si esto funciona, luego ponemos el rol)
        if (member) {
            const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return;

            const content = message.content ? `> ${message.content}` : "> *Sin contenido*";

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Message deleted')
                .setDescription(`**Autor:** <@${message.author.id}>\n**Contenido:**\n${content}`);

            await logChannel.send({ embeds: [embed] });
            console.log("✅ Embed enviado correctamente.");
        }
    } catch (err) {
        console.error('❌ Error:', err);
    }
});

client.once('ready', () => console.log(`✅ ${client.user.tag} conectado.`));

// 4. LOGIN (Esto va al final)
client.login(process.env.TOKEN);
