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
        // 1. Intentar detectar quién borró el mensaje (Audit Logs)
        let executor = null; // <-- CAMBIO: Iniciamos en null, no en el autor.
        await new Promise(r => setTimeout(r, 1200));
        
        try {
            const logs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
            const entry = logs.entries.first();
            
            if (entry && entry.target.id === message.author.id && (Date.now() - entry.createdTimestamp) < 10000) {
                executor = entry.executor;
            }
        } catch (e) { console.log("Audit log inaccesible"); }

        // <-- CAMBIO: Si no hay executor (se borró a sí mismo) o si el executor es el mismo autor, detenemos la ejecución.
        if (!executor || executor.id === message.author.id) return;

        // 2. Filtro de ROL (Solo procesar si el ejecutor tiene el rol)
        const member = await message.guild.members.fetch(executor.id).catch(() => null);
        if (!member || !member.roles.cache.has(MOD_ROLE_ID)) return;

        // 3. Construcción del Embed (Diseño final)
        const embed = new EmbedBuilder()
            .setColor('#E0B0FF')
            .setTitle('Message deleted')
            .setDescription(
                `**Channel:** <#${message.channel.id}>\n` +
                `**Message ID:** ${message.id}\n` +
                `**Message author:** @${message.author.username} (<@${message.author.id}>)\n` +
                `**Message created:** <t:${Math.floor(message.createdTimestamp / 1000)}:R>\n\n` +
                `**Message**\n${message.content || '*Sin texto*'}`
            )
            .setFooter({ 
                text: `${executor.username} • ${new Date(message.createdTimestamp).toLocaleDateString()}`, 
                iconURL: executor.displayAvatarURL() 
            });

        // 4. Lógica DINÁMICA de Attachments
        if (message.attachments.size > 0) {
            const attachmentList = message.attachments.map(a => `[${a.name}](${a.url})`).join('\n');
            
            embed.addFields({ 
                name: `${message.attachments.size} Attachment(s)`, 
                value: attachmentList 
            });
            
            // Si es imagen, mostrar previsualización
            const firstAttachment = message.attachments.first();
            if (firstAttachment.contentType?.startsWith('image/')) {
                embed.setImage(firstAttachment.url);
            }
        }

        // 5. Envío al canal de logs
        const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error("Error final:", err);
    }
});

client.login(process.env.TOKEN);
