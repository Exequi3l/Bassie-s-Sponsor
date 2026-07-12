const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const http = require('http'); // Para mantener el bot despierto en el hosting
require('dotenv').config();

// === VINCULACIÓN DEL PUERTO ===
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot online e operativo.');
}).listen(PORT, () => {
    console.log(`Servidor web escuchando en el puerto ${PORT}`);
});
// ==============================

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
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'search') {
        if (!args[0]) {
            return message.reply("❌ Por favor, menciona a un usuario o provee un ID válido.");
        }

        // Limpiamos menciones (ej: <@123456789> pasa a ser 123456789)
        const query = args[0].replace(/[<@!>]/g, '');
        
        // Los IDs de Discord tienen 17 o más números. Si tiene menos, asumimos que es de Roblox.
        const isRobloxSearch = query.length < 15;

        try {
            let targetDiscordId = null;
            let targetRobloxId = null;

            if (isRobloxSearch) {
                // 🔍 BÚSQUEDA POR ID DE ROBLOX
                const url = `https://api.bloxlink.biz/v3/roblox/${query}`;
                const response = await axios.get(url, { headers: { "Authorization": BLOXLINK_API_KEY } });
                
                // Bloxlink devuelve los usuarios de Discord vinculados en un array
                const discordUsers = response.data.discordUsers || [];
                if (discordUsers.length === 0) throw new Error("No vinculado");

                targetDiscordId = discordUsers[0]; // Primera cuenta de Discord vinculada
                targetRobloxId = query;
            } else {
                // 🔍 BÚSQUEDA POR ID DE DISCORD O MENCIÓN
                targetDiscordId = query;
                const url = `https://api.bloxlink.biz/v3/user/${targetDiscordId}`;
                const response = await axios.get(url, { headers: { "Authorization": BLOXLINK_API_KEY } });
                
                targetRobloxId = response.data.robloxId;
                if (!targetRobloxId) throw new Error("No vinculado");
            }

            // Obtener datos del usuario de Discord para el Embed
            const targetUser = await client.users.fetch(targetDiscordId).catch(() => null);
            if (!targetUser) throw new Error("Usuario no encontrado en Discord");

            // ✅ Embed de Éxito
            const embed = new EmbedBuilder()
                .setTitle(`${targetUser.displayName} [${targetUser.id}]`)
                .setColor(0x0099FF)
                .addFields({
                    name: "Users Connected:",
                    value: `<@${targetUser.id}> [${targetRobloxId}]`,
                    inline: false
                });

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            // Mostrar en la terminal si el problema es que la API Key es incorrecta
            if (error.response && error.response.status === 401) {
                console.error("⚠️ ERROR: Tu API Key de Bloxlink es inválida o no está configurada.");
            }

            // ❌ Embed de Error
            const errorEmbed = new EmbedBuilder()
                .setDescription("❌ Users not founded / doesnt exists")
                .setColor(0xFF0000);

            await message.channel.send({ embeds: [errorEmbed] });
        }
    }
});

// Iniciar sesión con el token guardado en las variables de entorno
client.login(process.env.DISCORD_TOKEN);
