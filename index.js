// ... (mantiene todo tu código de arriba hasta la parte de INTERACTIONS)

// ─────────────────────────────
// LOG DE BORRADOS (NUEVO)
// ─────────────────────────────

client.on('messageDelete', async (message) => {
  // Ignorar si el mensaje no está en caché o es un bot
  if (!message.author || message.author.bot || !message.guild) return;

  try {
    // Buscar al miembro que borró el mensaje
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);

    // Filtrar por el rol especial
    if (member && member.roles.cache.has(ALLOWED_ROLE_ID)) {
      
      const logChannel = await message.guild.channels.fetch(SAPPHIRE_LOG_CHANNEL).catch(() => null);
      if (!logChannel) return;

      // Formateo con ">" línea por línea
      const content = message.content 
        ? message.content.split('\n').map(line => `> ${line}`).join('\n') 
        : "> *Sin contenido de texto*";

      // Manejo de archivos adjuntos
      const attachCount = message.attachments.size;
      let attachText = "";
      if (attachCount > 0) {
        attachText = `\n\n**${attachCount} Attachment(s)**\n`;
        message.attachments.forEach(att => {
          attachText += `> [${att.name}](${att.url})\n`;
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#FF0000') // Rojo como pediste
        .setTitle('Message deleted')
        .setDescription(
          `**Channel:** <#${message.channel.id}>\n` +
          `**Message author:** <@${message.author.id}> (\`@${message.author.tag}\`)\n` +
          `**Message ID:** ${message.id}\n\n` +
          `**Message**\n${content}${attachText}`
        )
        .setThumbnail(message.author.displayAvatarURL())
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('❌ Error en el log de borrado:', err);
  }
});

// ... (El resto de tu código de INTERACTIONS, READY, y LOGIN sigue igual)
