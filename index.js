// 1. Importamos las librerías necesarias
const { Client, GatewayIntentBits } = require('discord.js');
const Groq = require('groq-sdk');
require('dotenv').config();

// 2. Configuramos la IA de Groq con Llama 3
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
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
    console.log(`🤖 ¡Bot tímido con Llama 3 activo como ${client.user.tag}!`);
});

// Evento: Cuando llega un mensaje al chat
client.on('messageCreate', async (message) => {
    // Regla 1: No responder a otros bots ni a sí mismo
    if (message.author.bot) return;

    // Regla 2: IGNORAR si el mensaje no está en el canal correcto
    if (message.channel.id !== CANAL_EXCLUSIVO_ID) return;

    // Regla 3: NUEVA - IGNORAR si el mensaje NO menciona al bot
    if (!message.mentions.has(client.user)) return;

    // Si pasa todos los filtros, activamos el indicador de "escribiendo..."
    await message.channel.sendTyping();

    try {
        // Limpiamos la mención del texto para que Llama 3 no se confunda con IDs raros
        const textoLimpio = message.content.replace(`<@${client.user.id}>`, '').trim();

        // Si el usuario solo etiquetó al bot sin escribir nada más
        if (!textoLimpio) {
            return await message.reply('¡U-uh...! ¿Me llamabas? ¿Necesitas algo...? 🥺🧺💕');
        }

        // Hacemos la petición a Groq usando Llama 3
        const respuestaIA = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant', 
            messages: [
                { 
                    role: 'system', 
                    content: 'Eres un asistente de Discord sumamente amable, educado y un poco tímido (puedes usar expresiones tiernas o dudar un poquito al hablar de forma sutil). Tu rasgo característico es que te encanta usar emojis, especialmente corazones (💖, 💕, 💝) y canastas (🧺, 🧺✨). Incorpora estos emojis de forma natural en tus respuestas amigables.' 
                },
                { 
                    role: 'user', 
                    content: textoLimpio 
                }
            ],
        });

        // Extraemos el texto que generó Llama 3
        const textoRespuesta = respuestaIA.choices[0].message.content;

        // Ajuste por el límite de caracteres de Discord
        if (textoRespuesta.length > 2000) {
            await message.reply(textoRespuesta.substring(0, 1990) + '...');
        } else {
            await message.reply(textoRespuesta);
        }

    } catch (error) {
        console.error('Error con la API de Groq:', error);
        await message.reply('❌ ¡U-uh...! Lo siento mucho... mi cerebrito de Llama 3 se sobrecalentó... 🥺💖');
    }
});

// Encendemos el bot
client.login(process.env.DISCORD_TOKEN);
