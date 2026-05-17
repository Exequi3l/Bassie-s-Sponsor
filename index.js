require('dotenv').config();

const fs = require('fs');
const express = require('express');

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot online');
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Servidor web iniciado');
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const ALLOWED_ROLE_ID = '1372698992239968326';

// 👇 CANAL DE LOGS SAPPHIRE
const SAPPHIRE_LOG_CHANNEL = '1406751369401991258';

if (!TOKEN || !CLIENT_ID) {
  console.error('Faltan variables de entorno');
  process.exit(1);
}

// ─────────────────────────────
// DATA
// ─────────────────────────────

const DATA_FILE = './data.json';

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '{}');
}

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ─────────────────────────────
// CLIENT
// ─────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ─────────────────────────────
// COMMANDS
// ─────────────────────────────

const commands = [

  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Ver historial joins/leaves')
    .addUserOption(opt =>
      opt
        .setName('usuario')
        .setDescription('Usuario')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Top leaves')

].map(c => c.toJSON());

// ─────────────────────────────
// REGISTER COMMANDS
// ─────────────────────────────

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {

  try {

    console.log('Registrando comandos...');

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log('Comandos registrados.');

  } catch (err) {
    console.error(err);
  }
})();

// ─────────────────────────────
// EXTRAER TEXTO
// ─────────────────────────────

function extractText(message) {

  let text = '';

  if (message.content) {
    text += message.content + ' ';
  }

  if (message.embeds.length > 0) {

    for (const embed of message.embeds) {

      if (embed.title)
        text += embed.title + ' ';

      if (embed.description)
        text += embed.description + ' ';

      if (embed.footer?.text)
        text += embed.footer.text + ' ';

      if (embed.fields?.length) {

        for (const field of embed.fields) {
          text += field.name + ' ';
          text += field.value + ' ';
        }
      }
    }
  }

  return text.toLowerCase();
}

// ─────────────────────────────
// ANALIZAR MENSAJE
// ─────────────────────────────

function processLogMessage(message) {

  if (message.channelId !== SAPPHIRE_LOG_CHANNEL)
    return;

  const text = extractText(message);

  if (!text) return;

  // Buscar IDs
  const ids =
    text.match(/\b\d{17,20}\b/g) || [];

  if (!ids.length) return;

  const data = loadData();

  for (const userId of ids) {

    if (!data[userId]) {
      data[userId] = {
        joins: 0,
        leaves: 0
      };
    }

    // JOINS
    if (
      text.includes('joined') ||
      text.includes('join') ||
      text.includes('member joined')
    ) {

      data[userId].joins++;

      console.log(
        `JOIN detectado ${userId}`
      );
    }

    // LEAVES
    if (
      text.includes('left') ||
      text.includes('leave') ||
      text.includes('member left')
    ) {

      data[userId].leaves++;

      console.log(
        `LEAVE detectado ${userId}`
      );
    }
  }

  saveData(data);
}

// ─────────────────────────────
// ESCUCHAR NUEVOS LOGS
// ─────────────────────────────

client.on('messageCreate', processLogMessage);

// ─────────────────────────────
// TRACK REAL
// ─────────────────────────────

client.on('guildMemberAdd', member => {

  const data = loadData();

  if (!data[member.id]) {
    data[member.id] = {
      joins: 0,
      leaves: 0
    };
  }

  data[member.id].joins++;

  saveData(data);

  console.log(`REAL JOIN ${member.user.tag}`);
});

client.on('guildMemberRemove', member => {

  const data = loadData();

  if (!data[member.id]) {
    data[member.id] = {
      joins: 0,
      leaves: 0
    };
  }

  data[member.id].leaves++;

  saveData(data);

  console.log(`REAL LEAVE ${member.user.tag}`);
});

// ─────────────────────────────
// IMPORTAR LOGS VIEJOS
// ─────────────────────────────

async function importOldLogs() {

  console.log(
    'Escaneando logs viejos de Sapphire...'
  );

  const channel =
    await client.channels.fetch(
      SAPPHIRE_LOG_CHANNEL
    );

  if (!channel) {
    console.log('Canal no encontrado');
    return;
  }

  let lastId;
  let total = 0;

  while (true) {

    const messages =
      await channel.messages.fetch({
        limit: 100,
        before: lastId
      });

    if (!messages.size) break;

    for (const message of messages.values()) {

      processLogMessage(message);

      total++;
    }

    lastId = messages.last().id;

    console.log(
      `Mensajes escaneados: ${total}`
    );
  }

  console.log(
    'Importación de logs completada.'
  );
}

// ─────────────────────────────
// PERMISSIONS
// ─────────────────────────────

function isAllowed(interaction) {

  const isOwner =
    interaction.guild.ownerId ===
    interaction.user.id;

  const hasRole =
    interaction.member.roles.cache.has(
      ALLOWED_ROLE_ID
    );

  return isOwner || hasRole;
}

// ─────────────────────────────
// COMMAND HANDLER
// ─────────────────────────────

client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand())
    return;

  // REGISTER

  if (interaction.commandName === 'register') {

    if (!isAllowed(interaction)) {

      return interaction.reply({
        content:
          '❌ Solo staff puede usar esto.',
        ephemeral: true
      });
    }

    const user =
      interaction.options.getUser(
        'usuario'
      );

    const data = loadData();

    const info = data[user.id] || {
      joins: 0,
      leaves: 0
    };

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(
        '📊 Registro de Usuario'
      )
      .setThumbnail(
        user.displayAvatarURL()
      )
      .addFields(
        {
          name: '👤 Usuario',
          value: user.tag
        },
        {
          name: '📥 Joins',
          value: `${info.joins}`,
          inline: true
        },
        {
          name: '📤 Leaves',
          value: `${info.leaves}`,
          inline: true
        }
      )
      .setFooter({
        text: `ID: ${user.id}`
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });
  }

  // LEADERBOARD

  if (
    interaction.commandName ===
    'leaderboard'
  ) {

    if (!isAllowed(interaction)) {

      return interaction.reply({
        content:
          '❌ Solo staff puede usar esto.',
        ephemeral: true
      });
    }

    const data = loadData();

    const sorted =
      Object.entries(data)
        .sort(
          (a, b) =>
            b[1].leaves -
            a[1].leaves
        )
        .slice(0, 10);

    const desc = sorted
      .map(
        (u, i) =>
          `#${i + 1} <@${u[0]}> — ${u[1].leaves} leaves`
      )
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle(
        '🏆 Leaderboard Leaves'
      )
      .setDescription(
        desc || 'Sin datos'
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });
  }
});

// ─────────────────────────────
// READY
// ─────────────────────────────

client.once('ready', async () => {

  console.log(
    `${client.user.tag} online.`
  );

  // ESCANEAR MENSAJES VIEJOS
  await importOldLogs();
});

// ─────────────────────────────
// LOGIN
// ─────────────────────────────

client.login(TOKEN);
