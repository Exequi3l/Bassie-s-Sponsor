require('dotenv').config();

const fs = require('fs');
const express = require('express');

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits
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

// 👇 rol staff permitido
const ALLOWED_ROLE_ID = '1498825341718761563';

if (!TOKEN || !CLIENT_ID) {
  console.error('Faltan variables de entorno');
  process.exit(1);
}

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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ─────────────────────────────
// COMMANDS (solo staff visibles)
// ─────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Ver historial de joins/leaves')
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Usuario')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Top 10 leaves')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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
// DATA TRACKING
// ─────────────────────────────

client.on('guildMemberAdd', member => {
  const data = loadData();

  if (!data[member.id]) {
    data[member.id] = { joins: 0, leaves: 0 };
  }

  data[member.id].joins++;
  saveData(data);
});

client.on('guildMemberRemove', member => {
  const data = loadData();

  if (!data[member.id]) {
    data[member.id] = { joins: 0, leaves: 0 };
  }

  data[member.id].leaves++;
  saveData(data);
});

// ─────────────────────────────
// PERMISSION CHECK (ROL + OWNER)
// ─────────────────────────────

function isAllowed(interaction) {
  const isOwner = interaction.guild.ownerId === interaction.user.id;
  const hasRole = interaction.member.roles.cache.has(ALLOWED_ROLE_ID);

  return isOwner || hasRole;
}

// ─────────────────────────────
// COMMAND HANDLER
// ─────────────────────────────

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // REGISTER
  if (interaction.commandName === 'register') {

    if (!isAllowed(interaction)) {
      return interaction.reply({
        content: '❌ Solo staff puede usar esto.',
        ephemeral: true
      });
    }

    const user = interaction.options.getUser('usuario');
    const data = loadData();
    const info = data[user.id] || { joins: 0, leaves: 0 };

    return interaction.reply({
      content:
        `📊 **${user.tag}**\n` +
        `Joins: ${info.joins}\n` +
        `Leaves: ${info.leaves}`
    });
  }

  // LEADERBOARD
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

    let msg = '';

    sorted.forEach((u, i) => {
      msg += `#${i + 1} <@${u[0]}> - ${u[1].leaves} leaves\n`;
    });

    return interaction.reply({
      content: msg || 'Sin datos'
    });
  }
});

client.once('ready', () => {
  console.log(`${client.user.tag} online.`);
});

client.login(TOKEN);
