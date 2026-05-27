require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, AuditLogEvent } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel]
});

const LOG_CHANNEL_ID = '1508962801518121060';
const MOD_ROLE_ID = '1458309307677540453'; 

client.on('messageDelete', async (message) => {
    if (!message.guild || message.author?.bot) return;

    try {
        // 1. Identificar ejecutor
        let executor = message.author;
        await new Promise(r => setTimeout(r, 1200));
        try {
            const logs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
            const entry = logs.entries.first();
            if (entry && entry.target.id === message.author.id && (Date.now() - entry.createdTimestamp) < 10000) {
                executor = entry.executor;
            }
        } catch (e) {}

        // 2. Filtro de ROL (Solo registra si el ejecutor tiene el rol)
        const member = await message.guild.members.fetch(executor.id).catch(() => null);
        if (!member || !member.roles.cache.has(MOD_ROLE_ID)) return;

        // 3. Diseño del Embed (Estilo Sapphire)
        const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor('#2b2d31') // Color oscuro estilo Discord
                .setTitle('Message deleted')
                .setDescription(
                    `**Channel:** <#${message.channel.id}>\n` +
                    `**Message ID:** ${message.id}\n` +
                    `**Message author:** <@${message.author.id}>\n` +
                    `**Message created:** <t:${Math.floor(message.createdTimestamp / 1000)}:R>\n\n` +
                    `**Message**\n${message.content || '*Sin contenido de texto*'}`
                )
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setFooter({ 
                    text: executor.tag, 
                    iconURL: executor.displayAvatarURL() 
                })
                .setTimestamp();
            
            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error("Error:", err);
    }
});

client.login(process.env.TOKEN);
