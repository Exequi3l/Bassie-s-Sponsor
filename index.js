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
  console.log('🌐 Servidor web iniciado');
});

// ─────────────────────────────
// ENV
// ─────────────────────────────

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {

  console.error(
    '❌ Faltan TOKEN o CLIENT_ID'
  );

  process.exit(1);
}

// ─────────────────────────────
// CONFIG
// ─────────────────────────────

const ALLOWED_ROLE_ID =
  '1372698992239968326';

const SAPPHIRE_LOG_CHANNEL =
  '1406751369401991258';

// logs antiguos a analizar

const MAX_OLD_MESSAGES = 3000;

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
      '📌 Registrando comandos...'
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
      '✅ Comandos registrados.'
    );

  } catch (err) {

    console.error(
      '❌ Error registrando comandos:',
      err
    );
  }
})();

// ─────────────────────────────
// EXTRAER TEXTO EMBEDS
// ─────────────────────────────

function extractText(message) {

  let text = '';

  if (message.content) {
    text += message.content + ' ';
  }

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
// PROCESS LOG MESSAGE
// ─────────────────────────────

async function processLogMessage(message) {

  if (
    message.channelId !==
    SAPPHIRE_LOG_CHANNEL
  ) return;

  const text = extractText(message);

  if (!text) return;

  // detectar joins/leaves sapphire

  const isJoin =
    text.includes('user joined');

  const isLeave =
    text.includes('user left');

  if (!isJoin && !isLeave)
    return;

  let userId = null;

  // mention real

  const mentionedUser =
    message.mentions.users.first();

  if (mentionedUser) {
    userId = mentionedUser.id;
  }

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

  // detectar ID: 123

  if (!userId) {

    const idMatch =
      text.match(
        /id:\s*(\d{17,20})/i
      );

    if (idMatch) {
      userId = idMatch[1];
    }
  }

  if (!userId) {

    console.log(
      '❌ No encontré ID'
    );

    return;
  }

  // ─────────────────────────
  // SOLO USERS EN SERVER
  // ─────────────────────────

  let member = null;

  try {

    member =
      await message.guild.members
        .fetch(userId)
        .catch(() => null);

  } catch {}

  if (!member) {

    console.log(
      `⚠️ Ignorado ${userId} (no está en server)`
    );

    return;
  }

  const data = loadData();

  ensureUser(data, userId);

  // JOIN

  if (isJoin) {

    data[userId].joins++;

    console.log(
      `📥 JOIN -> ${member.user.tag}`
    );
  }

  // LEAVE

  if (isLeave) {

    data[userId].leaves++;

    console.log(
      `📤 LEAVE -> ${member.user.tag}`
    );
  }

  saveData(data);
}

// ─────────────────────────────
// NUEVOS LOGS
// ─────────────────────────────

client.on(
  'messageCreate',
  async message => {

    try {

      await processLogMessage(
        message
      );

    } catch (err) {

      console.error(
        '❌ Error procesando log:',
        err
      );
    }
  }
);

// ─────────────────────────────
// IMPORTAR LOGS VIEJOS
// ─────────────────────────────

async function importOldLogs() {

  console.log(
    '🔎 Escaneando logs viejos...'
  );

  let channel;

  try {

    channel =
      await client.channels.fetch(
        SAPPHIRE_LOG_CHANNEL
      );

  } catch (err) {

    console.error(
      '❌ Error obteniendo canal:',
      err
    );

    return;
  }

  if (!channel) {

    console.log(
      '❌ Canal no encontrado.'
    );

    return;
  }

  let lastId = null;
  let total = 0;

  while (
    total < MAX_OLD_MESSAGES
  ) {

    let messages;

    try {

      messages =
        await channel.messages.fetch({
          limit: 100,
          before:
            lastId || undefined
        });

    } catch (err) {

      console.error(
        '❌ Error obteniendo mensajes:',
        err
      );

      break;
    }

    if (!messages.size)
      break;

    for (const message of messages.values()) {

      try {

        await processLogMessage(
          message
        );

      } catch (err) {

        console.error(
          '❌ Error mensaje:',
          err
        );
      }

      total++;

      if (
        total >=
        MAX_OLD_MESSAGES
      ) break;
    }

    lastId =
      messages.last().id;

    console.log(
      `📄 Analizados: ${total}/${MAX_OLD_MESSAGES}`
    );

    // evitar que Render lo mate

    await new Promise(resolve =>
      setTimeout(resolve, 2000)
    );
  }

  console.log(
    '✅ Importación completada.'
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

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      if (!member) {

        return interaction.reply({
          content:
            '❌ Usuario no encontrado en el servidor.',
          ephemeral: true
        });
      }

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

      const filtered = [];

      for (const [id, info] of Object.entries(data)) {

        const member =
          await interaction.guild.members
            .fetch(id)
            .catch(() => null);

        if (member) {
          filtered.push([id, info]);
        }
      }

      const sorted =
        filtered
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
      `✅ ${client.user.tag} online.`
    );

    setTimeout(async () => {

      try {

        await importOldLogs();

      } catch (err) {

        console.error(
          '❌ Error importando logs:',
          err
        );
      }

    }, 10000);
  }
);

// ─────────────────────────────
// ERRORES GLOBALES
// ─────────────────────────────

process.on(
  'unhandledRejection',
  err => {

    console.error(
      '❌ UnhandledRejection:',
      err
    );
  }
);

process.on(
  'uncaughtException',
  err => {

    console.error(
      '❌ UncaughtException:',
      err
    );
  }
);

// ─────────────────────────────
// LOGIN
// ─────────────────────────────

client.login(TOKEN);
