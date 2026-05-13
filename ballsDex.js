require('dotenv').config();

const fs = require('fs');
const express = require('express');

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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

if (!TOKEN || !CLIENT_ID) {
  console.error('Faltan variables de entorno');
  process.exit(1);
}

// ───────── DATA ─────────

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

// ───────── CLIENT ─────────

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ───────── CHUBBY SYSTEM ─────────

const ITEMS = [
  {
    id: "chubby_blue",
    name: "Chubby Azul",
    image: "https://i.imgur.com/example.png"
  },
  {
    id: "chubby_red",
    name: "Chubby Rojo",
    image: "https://i.imgur.com/example2.png"
  }
];

let currentSpawn = null;
let claimed = false;

// ───────── SPAWN ─────────

function spawnChubby(client) {

  const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];

  currentSpawn = item;
  claimed = false;

  const channel = client.channels.cache.find(c => c.isTextBased());
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("✨ ¡Apareció un Chubby!")
    .setDescription("Haz click en el botón para capturarlo")
    .setImage(item.image)
    .setColor("#ff66cc");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("claim_chubby")
      .setLabel("Capturar")
      .setStyle(ButtonStyle.Success)
  );

  channel.send({
    embeds: [embed],
    components: [row]
  });
}

// ───────── COMMANDS (INVENTORY) ─────────

const commands = [
  new REST({ version: '10' }).setToken(TOKEN)
];

(async () => {
  try {
    await commands[0].put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: [
          new (require('discord.js').SlashCommandBuilder)()
            .setName('inventory')
            .setDescription('Ver tu colección')
            .toJSON()
        ]
      }
    );
    console.log('Comandos registrados');
  } catch (err) {
    console.error(err);
  }
})();

// ───────── READY ─────────

client.once('ready', () => {
  console.log(`${client.user.tag} online`);

  setInterval(() => {
    spawnChubby(client);
  }, 60000); // cada 60s
});

// ───────── INTERACTIONS ─────────

client.on('interactionCreate', async interaction => {

  // ───── BUTTON ─────
  if (interaction.isButton() && interaction.customId === 'claim_chubby') {

    if (!currentSpawn || claimed) {
      return interaction.reply({
        content: "❌ Este chubby ya fue capturado.",
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId('chubby_modal')
      .setTitle('Capturar Chubby');

    const input = new TextInputBuilder()
      .setCustomId('chubby_name')
      .setLabel('Escribe el nombre del Chubby')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    return interaction.showModal(modal);
  }

  // ───── MODAL ─────
  if (interaction.isModalSubmit() && interaction.customId === 'chubby_modal') {

    if (!currentSpawn) {
      return interaction.reply({
        content: "❌ No hay chubby activo.",
        ephemeral: true
      });
    }

    if (claimed) {
      return interaction.reply({
        content: "❌ Ya fue capturado.",
        ephemeral: true
      });
    }

    const input = interaction.fields.getTextInputValue('chubby_name');

    if (input.toLowerCase() !== currentSpawn.name.toLowerCase()) {
      return interaction.reply({
        content: "❌ Nombre incorrecto del chubby.",
        ephemeral: true
      });
    }

    const data = loadData();
    const userId = interaction.user.id;

    if (!data[userId]) {
      data[userId] = { collection: [] };
    }

    data[userId].collection.push(currentSpawn.id);
    saveData(data);

    claimed = true;

    return interaction.reply({
      content:
        `🎉 ¡Capturaste a **${currentSpawn.name}**!\n` +
        `Usa /inventory para ver tu colección.`
    });
  }

  // ───── INVENTORY ─────
  if (interaction.isChatInputCommand() && interaction.commandName === 'inventory') {

    const data = loadData();
    const user = data[interaction.user.id];

    if (!user || !user.collection.length) {
      return interaction.reply({
        content: "📦 No tienes chubbies aún.",
        ephemeral: true
      });
    }

    return interaction.reply({
      content:
        `📦 Tu colección:\n` +
        user.collection.map(x => `- ${x}`).join('\n')
    });
  }
});

client.login(TOKEN);
