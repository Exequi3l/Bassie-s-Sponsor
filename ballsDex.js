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
  Routes,
  SlashCommandBuilder
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

// ID DEL SERVIDOR
const GUILD_ID = "1497767350211186960";

// ID DEL CANAL DONDE APARECEN LOS CHUBBYS
const SPAWN_CHANNEL_ID = "1497767351041654896";

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
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// ───────── CHUBBYS ─────────

const ITEMS = [
  {
    id: "boxten",
    name: "Boxten",
    emoji: "📦",
    image: "https://raw.githubusercontent.com/Exequi3l/Chubbys-Assets/main/Boxten.png"
  }
];

let currentSpawn = null;
let claimed = false;

// ───────── SPAWN ─────────

async function spawnChubby(client) {

  console.log("Intentando spawn...");

  const item = ITEMS[0];

  currentSpawn = item;
  claimed = false;

  try {

    // FETCH REAL DEL CANAL
    const channel = await client.channels.fetch(SPAWN_CHANNEL_ID);

    if (!channel) {
      console.log("Canal no encontrado");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Un Chubby mágico ha aparecido...")
      .setDescription("Haz click en el botón para capturarlo antes de que desaparezca!")
      .setImage(item.image)
      .setColor("#ff66cc");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_chubby")
        .setLabel("Capturar")
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({
      embeds: [embed],
      components: [row]
    });

    console.log("Chubby enviado correctamente");

  } catch (err) {
    console.error("Error enviando chubby:", err);
  }
}

// ───────── SLASH COMMANDS ─────────

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {

  try {

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      {
        body: [
          new SlashCommandBuilder()
            .setName('coleccion')
            .setDescription('Ver colección avanzada de chubbys')
        ].map(c => c.toJSON())
      }
    );

    console.log('Comandos registrados en GUILD');

  } catch (err) {
    console.error(err);
  }

})();

// ───────── READY ─────────

client.once('ready', async () => {

  console.log(`${client.user.tag} online`);

  // SPAWN INSTANTÁNEO
  await spawnChubby(client);

  console.log("Primer Chubby enviado");

  // SPAWNS AUTOMÁTICOS
  setInterval(async () => {
    await spawnChubby(client);
  }, 30000); // cada 30 segundos

});

// ───────── INTERACTIONS ─────────

client.on('interactionCreate', async interaction => {

  // ───── BUTTON ─────
  if (
    interaction.isButton() &&
    interaction.customId === 'claim_chubby'
  ) {

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

    modal.addComponents(
      new ActionRowBuilder().addComponents(input)
    );

    return interaction.showModal(modal);
  }

  // ───── MODAL ─────
  if (
    interaction.isModalSubmit() &&
    interaction.customId === 'chubby_modal'
  ) {

    if (!currentSpawn || claimed) {
      return interaction.reply({
        content: "❌ No hay chubby activo.",
        ephemeral: true
      });
    }

    const input =
      interaction.fields.getTextInputValue('chubby_name');

    if (
      input.toLowerCase() !==
      currentSpawn.name.toLowerCase()
    ) {
      return interaction.reply({
        content: "❌ Nombre incorrecto del chubby.",
        ephemeral: true
      });
    }

    const data = loadData();
    const userId = interaction.user.id;

    if (!data[userId]) {
      data[userId] = {
        collection: []
      };
    }

    data[userId].collection.push(currentSpawn.id);

    saveData(data);

    claimed = true;

    return interaction.reply({
      content: `🎉 ¡Capturaste a **Boxten**!`
    });
  }

  // ───── COLECCION ─────
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === 'coleccion'
  ) {

    const data = loadData();

    const user = data[interaction.user.id];

    if (!user || !user.collection.length) {
      return interaction.reply({
        content: "📦 No tienes chubbys aún.",
        ephemeral: true
      });
    }

    const totalUnique = ITEMS.length;

    const ownedUnique = 1;

    const percent = (
      (ownedUnique / totalUnique) * 100
    ).toFixed(1);

    let text =
      "📦 **Tu colección de chubbys:**\n\n";

    text += `📦 Boxten x${user.collection.length}\n`;

    text +=
      `\n📊 Llevas un ${percent}% de la colección total`;

    return interaction.reply({
      content: text
    });
  }

});

client.login(TOKEN);
