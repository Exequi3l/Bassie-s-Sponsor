const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios'); // Usamos axios para las peticiones a la API
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = "!";
const BLOXLINK_API_KEY = "8fe9f751-9316-4fe1-82f7-2438e97db65a";

client.on('messageCreate', async (message) => {
    // Ignorar mensajes de bots o que no empiecen con el prefijo
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/+/);
    const command = args.shift().toLowerCase();

    if (command === 'search') {
        // Obtener el usuario mencionado o por ID
        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);

        if (!targetUser) {
            return message.reply("Por favor, menciona a un usuario o provee un ID válido.");
        }

        const url = `https://api.bloxlink.biz/v3/user/${targetUser.id}`;

        try {
            const response = await axios.get(url, {
                headers: { "Authorization": BLOXLINK_API_KEY }
            });

            const robloxId = response.data.robloxId || "No encontrado";

            // Crear el Embed de éxito
            const embed = new EmbedBuilder()
                .setTitle(`${targetUser.displayName} [${targetUser.id}]`)
                .setColor(0x0099FF) // Azul
                .addFields({
                    name: "Users Connected:",
                    value: `<@${targetUser.id}> [${robloxId}]`,
