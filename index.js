const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes
} = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) {
  console.error("TOKEN no definido en variables de entorno");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("CLIENT_ID no definido en variables de entorno");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName('sponsor')
    .setDescription('Muestra el canal de YouTube')
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log('Comando registrado.');
  } catch (err) {
    console.error(err);
  }
})();

client.once('ready', () => {
  console.log(`${client.user.tag} online.`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'sponsor') {

    const embed = new EmbedBuilder()
      .setTitle('🍪 Canal Oficial')
      .setDescription(
        "La Choza de las Canastas cuenta con un canal de Youtube, en donde su creador publica videos respecto a Dandy's World.\n\n¡Puedes apretar el botón de abajo para redirigir a su canal!"
      )
      .setColor('#FF0000');

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Ir al canal')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.youtube.com/channel/UCSU4wfkOl76hMOik0U7Cr8Q')
      );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
});

client.login(TOKEN);
