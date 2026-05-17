require('dotenv').config();

const fs = require('fs');
const express = require('express');

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder
} = require('discord.js');

// ─────────────────────────────
// EXPRESS
// ─────────────────────────────

const app = express();

app.get('/', (req, res) => {
  res.send('Bot online');
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Servidor web iniciado');
});

// ─────────────────────────────
// ENV
// ─────────────────────────────

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('Faltan variables de entorno');
  process.exit(1);
}

// ─────────────────────────────
// CONFIG
// ─────────────────────────────

const ALLOWED_ROLE_ID =
  '1372698992239968326';

const SAPPHIRE_LOG_CHANNEL =
  '1406751369401991258';

// ─────────────────────────────
// DATA
// ─────────────────────────────

const DATA_FILE = './data.json';

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '{}');
}

function loadData() {

  try {

    return JSON.parse(
      fs.readFileSync(
        DATA_FILE,
        'utf8'
      )
    );

  } catch {

    return {};
  }
}

function saveData(data) {

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

function ensureUser(data, userId) {

  if (!data[userId]) {

    data[userId] = {
      joins: 0,
      leaves: 0
    };
  }
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
    .setDescription(
      'Ver historial joins/leaves'
    )
    .addUserOption(opt =>
      opt
        .setName('usuario')
        .setDescription('Usuario')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription(
      'Top leaves'
    )

].map(c => c.toJSON());

// ─────────────────────────────
// REGISTER COMMANDS
// ─────────────────────────────

const rest =
  new REST({ version: '10' })
    .setToken(TOKEN);

(async () => {

  try {

    console.log(
      'Registrando comandos...'
    );

    await rest.put(
      Routes.applicationCommands(
        CLIENT_ID
      ),
      {
        body: commands
      }
    );

    console.log(
      'Comandos registrados.'
    );

  } catch (err) {

    console.error(err);
  }
})();

// ─────────────────────────────
// EXTRAER TEXTO
// ─────────────────────────────

function extractText(message) {

  let text = '';

  // CONTENT
  if (message.content) {
    text += message.content + ' ';
  }

  // EMBEDS
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

  return text.toLowerCase();
}

// ─────────────────────────────
// PROCESS SAPPHIRE LOGS
// ─────────────────────────────

async function processLogMessage(message) {

  if (
    message.channelId !==
    SAPPHIRE_LOG_CHANNEL
  ) return;

  const text = extractText(message);

  if (!text) return;

  let userId = null;

  // PRIORIDAD 1:
  // mentions reales

  const mentionedUser =
    message.mentions.users.first();

  if (mentionedUser) {
    userId = mentionedUser.id;
  }

  // PRIORIDAD 2:
  // detectar IDs cerca de user/member/id

  if (!userId) {

    const match = text.match(
      /(user|member|id)[^\d]{0,15}(\d{17,20})/i
    );

    if (match) {
      userId = match[2];
    }
  }

  // PRIORIDAD 3:
  // detectar <@id>

  if (!userId) {

    const mentionMatch =
      text.match(
        /<@!?(\d{17,20})>/
      );

    if (mentionMatch) {
      userId = mentionMatch[1];
    }
  }

  if (!userId) return;

  // ─────────────────────────
  // SOLO SI EXISTE EN SERVER
  // ─────────────────────────

  let member = null;

  try {

    member =
      await message.guild.members
        .fetch(userId)
        .catch(() => null);

  } catch {

    return;
  }

  // ignorar usuarios inexistentes

  if (!member) {

    console.log(
      `IGNORADO ${userId}`
    );

    return;
  }

  const data = loadData();

  ensureUser(data, userId);

  const isJoin =
    text.includes('joined') ||
    text.includes('member joined');

  const isLeave =
    text.includes('left') ||
    text.includes('member left');

  // evitar dobles raros

  if (isJoin && !isLeave) {

    data[userId].joins++;

    console.log(
      `JOIN SAPPHIRE -> ${member.user.tag}`
    );
  }

  else if (isLeave && !isJoin) {

    data[userId].leaves++;

    console.log(
      `LEAVE SAPPHIRE -> ${member.user.tag}`
    );
  }

  else {

    return;
  }

  saveData(data);
}

// ─────────────────────────────
// NUEVOS LOGS
// ─────────────────────────────

client.on(
  'messageCreate',
  async message => {

    await processLogMessage(
      message
    );
  }
);

// ─────────────────────────────
// TRACK REAL
// ─────────────────────────────

client.on(
  'guildMemberAdd',
  member => {

    const data = loadData();

    ensureUser(data, member.id);

    data[member.id].joins++;

    saveData(data);

    console.log(
      `REAL JOIN -> ${member.user.tag}`
    );
  }
);

client.on(
  'guildMemberRemove',
  member => {

    const data = loadData();

    ensureUser(data, member.id);

    data[member.id].leaves++;

    saveData(data);

    console.log(
      `REAL LEAVE -> ${member.user.tag}`
    );
  }
);

// ─────────────────────────────
// IMPORTAR LOGS VIEJOS
// ─────────────────────────────

async function importOldLogs() {

  console.log(
    'Escaneando logs viejos...'
  );

  const channel =
    await client.channels.fetch(
      SAPPHIRE_LOG_CHANNEL
    );

  if (!channel) {

    console.log(
      'Canal no encontrado.'
    );

    return;
  }

  let lastId = null;
  let total = 0;

  while (true) {

    const messages =
      await channel.messages.fetch({
        limit: 100,
        before:
          lastId || undefined
      });

    if (!messages.size)
      break;

    for (const message of messages.values()) {

      await processLogMessage(
        message
      );

      total++;
    }

    lastId =
      messages.last().id;

    console.log(
      `Mensajes analizados: ${total}`
    );
  }

  console.log(
    'Importación completada.'
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
// INTERACTIONS
// ─────────────────────────────

client.on(
  'interactionCreate',
  async interaction => {

    if (
      !interaction.isChatInputCommand()
    ) return;

    // ───────── REGISTER ─────────

    if (
      interaction.commandName ===
      'register'
    ) {

      if (
        !isAllowed(interaction)
      ) {

        return interaction.reply({
          content:
            '❌ Solo staff.',
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser(
          'usuario'
        );

      const data =
        loadData();

      const info =
        data[user.id] || {
          joins: 0,
          leaves: 0
        };

      const embed =
        new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(
            '📊 Registro Usuario'
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
            text:
              `ID: ${user.id}`
          })
          .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });
    }

    // ───────── LEADERBOARD ─────────

    if (
      interaction.commandName ===
      'leaderboard'
    ) {

      if (
        !isAllowed(interaction)
      ) {

        return interaction.reply({
          content:
            '❌ Solo staff.',
          ephemeral: true
        });
      }

      const data =
        loadData();

      const sorted =
        Object.entries(data)
          .sort(
            (a, b) =>
              b[1].leaves -
              a[1].leaves
          )
          .slice(0, 10);

      const description =
        sorted.length
          ? sorted.map(
              (u, i) =>
                `#${i + 1} <@${u[0]}> — ${u[1].leaves} leaves`
            ).join('\n')
          : 'Sin datos';

      const embed =
        new EmbedBuilder()
          .setColor('#ED4245')
          .setTitle(
            '🏆 Leaderboard Leaves'
          )
          .setDescription(
            description
          )
          .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });
    }
  }
);

// ─────────────────────────────
// READY
// ─────────────────────────────

client.once(
  'ready',
  async () => {

    console.log(
      `${client.user.tag} online.`
    );

    // IMPORTAR LOGS VIEJOS
    await importOldLogs();
  }
);

// ─────────────────────────────
// LOGIN
// ─────────────────────────────

client.login(TOKEN);
