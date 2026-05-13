require('dotenv').config();

const fs = require('fs');
const express = require('express');

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
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

// 👇 ROLE STAFF
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
// COMMANDS
// ─────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Ver historial de un usuario')
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Usuario')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ViewChannel),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Top 10 más leaves')
    .setDefaultMemberPermissions(PermissionFlagsBits.ViewChannel)
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
    console.log('Comandos listos.');
  } catch (err) {
    console.error(err);
  }
})();

// ─────────────────────────────
// READY
// ─────────────────────────────

client.once('ready', () => {
  console.log(`${client.user.tag} online.`);
});

// ─────────────────────────────
// TRACK JOINS / LEAVES
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
// PERMISSION CHECK
// ─────────────────────────────

function isAllowed(interaction) {
  const isOwner = interaction.guild.ownerId === interaction.user.id;
  const hasRole = interaction.member.roles.cache.has(ALLOWED_ROLE_ID);
  return isOwner || hasRole;
}

// ─────────────────────────────
// COMMANDS LOGIC
// ─────────────────────────────

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // REGISTER
  if (interaction.commandName === 'register') {

    if (!isAllowed(interaction)) {
      return interaction.reply({
        content: '❌ No tienes permiso.',
        ephemeral: true
      });
    }

    const user = interaction.options.getUser('usuario');
    const data = loadData();

    const info = data[user.id] || { joins: 0, leaves: 0 };

    const embed = new EmbedBuilder()
      .setTitle('📊 Registro de Usuario')
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        {
          name: 'Usuario',
          value: `${user} | \`${user.id}\``
        },
        {
          name: 'Joins',
          value: `${info.joins}`,
          inline: true
        },
        {
          name: 'Leaves',
          value: `${info.leaves}`,
          inline: true
        }
      )
      .setColor('#5865F2');

    return interaction.reply({
      embeds: [embed]
    });
  }

  // LEADERBOARD
  if (interaction.commandName === 'leaderboard') {

    if (!isAllowed(interaction)) {
      return interaction.reply({
        content: '❌ No tienes permiso.',
        ephemeral: true
      });
    }

    const data = loadData();

    const sorted = Object.entries(data)
      .sort((a, b) => b[1].leaves - a[1].leaves)
      .slice(0, 10);

    let desc = '';

    sorted.forEach((x, i) => {
      desc += `**#${i + 1}** <@${x[0]}> | \`${x[0]}\`\nLeaves: **${x[1].leaves}**\n\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🏆 Top Leaves')
      .setDescription(desc || 'Sin datos')
      .setColor('#FF0000')
      .setThumbnail(client.user.displayAvatarURL());

    return interaction.reply({
      embeds: [embed]
    });
  }
});

client.login(TOKEN);
