require('dotenv').config();

const fs = require('fs');
const express = require('express');

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  REST,
  Routes
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

const ALLOWED_ROLE_ID = '1498825341718761563';

if (!TOKEN) {
  console.error('TOKEN no definido');
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error('CLIENT_ID no definido');
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

const commands = [

  new SlashCommandBuilder()
    .setName('sponsor')
    .setDescription('Muestra el canal de YouTube'),

  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Ver historial de joins y leaves')
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuario a revisar')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Top 10 usuarios con más leaves')

].map(command => command.toJSON());

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

client.once('ready', () => {
  console.log(`${client.user.tag} online.`);
});

client.on('guildMemberAdd', member => {

  const data = loadData();

  if (!data[member.id]) {
    data[member.id] = {
      joins: 0,
      leaves: 0
    };
  }

  data[member.id].joins += 1;

  saveData(data);
});

client.on('guildMemberRemove', member => {

  const data = loadData();

  if (!data[member.id]) {
    data[member.id] = {
      joins: 0,
      leaves: 0
    };
  }

  data[member.id].leaves += 1;

  saveData(data);
});

client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'sponsor') {

    const embed = new EmbedBuilder()
      .setTitle('🍪 Canal Oficial')
      .setDescription(
        'La Choza de las Canastas tiene un canal de YouTube.\n\nHaz clic abajo para verlo.'
      )
      .setColor('#FF0000');

    return interaction.reply({
      embeds: [embed]
    });
  }

  if (interaction.commandName === 'register') {

    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return interaction.reply({
        content: '❌ No tienes permiso para usar este comando.',
        ephemeral: true
      });
    }

    const user = interaction.options.getUser('usuario');

    const data = loadData();

    const userData = data[user.id] || {
      joins: 0,
      leaves: 0
    };

    const embed = new EmbedBuilder()
      .setTitle('📋 User Register')
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        {
          name: 'User',
          value: `${user} | \`${user.id}\``
        },
        {
          name: 'Joins of user',
          value: `${userData.joins}`,
          inline: true
        },
        {
          name: 'Leaves of user',
          value: `${userData.leaves}`,
          inline: true
        }
      )
      .setColor('#5865F2')
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });
  }

  if (interaction.commandName === 'leaderboard') {

    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return interaction.reply({
        content: '❌ No tienes permiso para usar este comando.',
        ephemeral: true
      });
    }

    const data = loadData();

    const sorted = Object.entries(data)
      .sort((a, b) => b[1].leaves - a[1].leaves)
      .slice(0, 10);

    let description = '';

    for (let i = 0; i < sorted.length; i++) {

      const [userId, stats] = sorted[i];

      description +=
        `**#${i + 1}** <@${userId}> | \`${userId}\`\n` +
        `Leaves: **${stats.leaves}**\n\n`;
    }

    if (!description) {
      description = 'No hay datos registrados.';
    }

    const embed = new EmbedBuilder()
      .setTitle('🏆 Leaves Leaderboard')
      .setDescription(description)
      .setColor('#FF0000')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });
  }
});

client.login(TOKEN);
