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

// 👇 CANAL LOGS SAPPHIRE
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
    .setDescription('Ver historial de joins/leaves')
    .addUserOption(opt =>
      opt
        .setName('usuario')
        .setDescription('Usuario')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Top 10 leaves')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    )
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
// TRACK REAL JOINS/LEAVES
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

  console.log(`JOIN REAL: ${member.user.tag}`);
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

  console.log(`LEAVE REAL: ${member.user.tag}`);
});

// ─────────────────────────────
// SAPPHIRE LOGS IMPORT
// ─────────────────────────────

client.on('messageCreate', message => {

  if (message.channelId !== SAPPHIRE_LOG_CHANNEL) return;

  const data = loadData();

  let text = message.content?.toLowerCase() || '';

  // Leer embeds de Sapphire
  if (!text && message.embeds.length > 0) {

    const embed = message.embeds[0];

    text =
      (
        (embed.title || '') +
        ' ' +
        (embed.description || '') +
        ' ' +
        (embed.footer?.text || '')
      ).toLowerCase();
  }

  if (!text) return;

  // Detectar ID usuario
  const userId =
    message.mentions.users.first()?.id ||
    text.match(/\b\d{17,20}\b/)?.[0];

  if (!userId) return;

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

    saveData(data);

    console.log(`JOIN SAPPHIRE: ${userId}`);
  }

  // LEAVES
  if (
    text.includes('left') ||
    text.includes('leave') ||
    text.includes('member left')
  ) {

    data[userId].leaves++;

    saveData(data);

    console.log(`LEAVE SAPPHIRE: ${userId}`);
  }
});

// ─────────────────────────────
// PERMISSIONS
// ─────────────────────────────

function isAllowed(interaction) {

  const isOwner =
    interaction.guild.ownerId === interaction.user.id;

  const hasRole =
    interaction.member.roles.cache.has(ALLOWED_ROLE_ID);

  return isOwner || hasRole;
}

// ─────────────────────────────
// COMMANDS HANDLER
// ─────────────────────────────

client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand()) return;

  // ───────── REGISTER ─────────

  if (interaction.commandName === 'register') {

    if (!isAllowed(interaction)) {

      return interaction.reply({
        content: '❌ Solo staff puede usar esto.',
        ephemeral: true
      });
    }

    const user =
      interaction.options.getUser('usuario');

    const data = loadData();

    const info = data[user.id] || {
      joins: 0,
      leaves: 0
    };

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📊 Registro de Usuario')
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        {
          name: '👤 Usuario',
          value: `${user.tag}`,
          inline: false
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

  // ───────── LEADERBOARD ─────────

  if (interaction.commandName === 'leaderboard') {

    if (!isAllowed(interaction)) {

      return interaction.reply({
        content: '❌ Solo staff puede usar esto.',
        ephemeral: true
      });
    }

    const data = loadData();

    const sorted = Object.entries(data)
      .sort((a, b) => b[1].leaves - a[1].leaves)
      .slice(0, 10);

    if (!sorted.length) {
      return interaction.reply({
        content: 'Sin datos'
      });
    }

    const desc = sorted
      .map((u, i) =>
        `#${i + 1} <@${u[0]}> — ${u[1].leaves} leaves`
      )
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🏆 Leaderboard Leaves')
      .setDescription(desc)
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });
  }
});

// ─────────────────────────────
// READY
// ─────────────────────────────

client.once('ready', () => {

  console.log(`${client.user.tag} online.`);
});

// ─────────────────────────────
// LOGIN
// ─────────────────────────────

client.login(TOKEN);
