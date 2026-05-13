require('dotenv').config();

const fs = require('fs');
const express = require('express');

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
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
// 🎮 BALLSDEX SYSTEM
// ─────────────────────────────

const ITEMS = [
  { id: "fire_ball", name: "Fire Ball 🔥" },
  { id: "water_ball", name: "Water Ball 💧" },
  { id: "shadow_ball", name: "Shadow Ball 🌑" },
  { id: "light_ball", name: "Light Ball ✨" }
];

let currentSpawn = null;
let spawnChannel = null;

function spawnItem(channel) {
  const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];

  currentSpawn = item;
  spawnChannel = channel;

  channel.send(
    `✨ Ha aparecido un **${item.name}**!\n` +
    `Escribe: \`/claim\` para capturarlo`
  );
}


// ─────────────────────────────
// COMMANDS
// ─────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Captura el item que aparece'),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Ver tus items')
].map(c => c.toJSON());

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
// JOINS / LEAVES TRACKING
// ─────────────────────────────

client.on('guildMemberAdd', member => {
  const data = loadData();

  if (!data[member.id]) {
    data[member.id] = { joins: 0, leaves: 0, collection: [] };
  }

  data[member.id].joins++;
  saveData(data);
});

client.on('guildMemberRemove', member => {
  const data = loadData();

  if (!data[member.id]) {
    data[member.id] = { joins: 0, leaves: 0, collection: [] };
  }

  data[member.id].leaves++;
  saveData(data);
});


// ─────────────────────────────
// READY + SPAWN LOOP
// ─────────────────────────────

client.once('ready', () => {
  console.log(`${client.user.tag} online.`);

  const channel = client.channels.cache.find(c => c.isTextBased());

  setInterval(() => {
    if (channel) spawnItem(channel);
  }, 60000); // cada 60s
});


// ─────────────────────────────
// INTERACTIONS
// ─────────────────────────────

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // ── CLAIM ──
  if (interaction.commandName === 'claim') {

    if (!currentSpawn) {
      return interaction.reply({
        content: '❌ No hay ningún item activo.',
        ephemeral: true
      });
    }

    const data = loadData();

    if (!data[interaction.user.id]) {
      data[interaction.user.id] = {
        joins: 0,
        leaves: 0,
        collection: []
      };
    }

    data[interaction.user.id].collection.push(currentSpawn.id);
    saveData(data);

    const claimed = currentSpawn;
    currentSpawn = null;

    return interaction.reply({
      content: `🎉 Capturaste: **${claimed.name}**`
    });
  }

  // ── INVENTORY ──
  if (interaction.commandName === 'inventory') {

    const data = loadData();
    const user = data[interaction.user.id];

    if (!user || !user.collection.length) {
      return interaction.reply({
        content: '📦 No tienes items aún.',
        ephemeral: true
      });
    }

    return interaction.reply({
      content:
        `📦 **Tu inventario:**\n` +
        user.collection.map(i => `- ${i}`).join('\n')
    });
  }
});

client.login(TOKEN);
