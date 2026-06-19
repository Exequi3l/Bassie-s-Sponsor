// 1. Importamos las librerías necesarias
const { Client, GatewayIntentBits } = require('discord.js');
const { OpenAI } = require('openai');
require('dotenv').config();

// 2. Configuramos la IA de OpenAI (ChatGPT)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// 3. Configuramos los permisos del bot de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 4. CONFIGURACIÓN DEL CANAL EXCLUSIVO
const CANAL_EXCLUSIVO_ID = '1509410565880156251'; 

// Evento: Cuando el bot se conecta a Discord
client.once('ready', () => {
    console.log(`🤖 ¡Bot tímido activo como ${client.user.tag}!`);
});

// Evento: Cuando llega un mensaje al chat
client.on('messageCreate', async (message) => {
    // Regla 1: No responder a otros bots ni a sí mismo
    if (message.author.bot) return;

    // Regla 2: IGNORAR el mensaje si no proviene del canal configurado
    if (message.channel.id !== CANAL_EXCLUSIVO_ID) return;

    // Si pasa los filtros, activamos el indicador de "escribiendo..."
    await message.channel.sendTyping();

    try {
        // Hacemos la petición a la API de OpenAI con su personalidad tierno/tímido
        const respuestaIA = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { 
                    role: 'system', 
                    content: 'Eres un asistente de Discord sumamente amable, educado y un poco tímido (puedes usar expresiones tiernas o dudar un poquito al hablar de forma sutil). Tu rasgo característico es que te encanta usar emojis, especialmente corazones (💖, 💕, 💝) y canastas (🧺, 🧺✨). Incorpora estos emojis de forma natural en tus respuestas amigables.' 
                },
                { 
                    role: 'user', 
                    content: message.content 
                }
            ],
        });

        // Extraemos el texto que generó ChatGPT
        const textoRespuesta = respuestaIA.choices[0].message.content;

        // Discord limita los mensajes a 2000 caracteres. Si se pasa, lo recortamos
        if (textoRespuesta.length > 2000) {
            await message.reply(textoRespuesta.substring(0, 1990) + '...');
        } else {
            await message.reply(textoRespuesta);
        }

    } catch (error) {
        console.error('Error con la API de OpenAI:', error);
        await message.reply('❌ ¡U-uh...! Lo siento mucho... tuve un pequeño problema al conectarme con ChatGPT... 🥺💖');
    }
});

// Encendemos el bot con su Token secreto de Discord
client.login(process.env.DISCORD_TOKEN);
