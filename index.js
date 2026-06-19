// 1. Importamos las librerías necesarias
const { Client, GatewayIntentBits } = require('discord.js');
const Groq = require('groq-sdk');
const http = require('http'); // Requerido para el truco del puerto en Render
require('dotenv').config();

// 2. CONFIGURACIÓN DEL PUERTO PARA RENDER (Web Service)
// Esto crea un servidor web falso para que Render no apague tu bot
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('¡Bot activo y escuchando!\n');
}).listen(PORT, () => {
    console.log(`🌍 Servidor web falso escuchando en el puerto ${PORT}`);
});

// 3. Configuramos la IA de Groq
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// 4. Configuramos los permisos del bot de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 5. CONFIGURACIÓN DEL CANAL EXCLUSIVO
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

    // Regla 3: IGNORAR si el mensaje NO menciona al bot
    if (!message.mentions.has(client.user)) return;

    // Activamos el indicador de "escribiendo..."
    await message.channel.sendTyping();

    try {
        // Limpiamos la mención del texto para la IA
        const textoLimpio = message.content.replace(`<@${client.user.id}>`, '').trim();

        if (!textoLimpio) {
            return await message.reply('¡U-uh...! ¿Me llamabas? ¿Necesitas algo...? 🥺 Basket 🧺💕');
        }

        // --- PALABRAS CLAVE / INFORMACIÓN DE FONDO ---
        const informacionDeFondo = `
        INFORMACIÓN ADICIONAL Y PALABRAS CLAVE:
        - El servidor de Discord actual es un espacio amigable.
        - [Puedes escribir aquí datos clave en el futuro para mantenerlo informado]
        `;

        // Petición a Groq con Llama 3
        const respuestaIA = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant', 
            messages: [
                { 
                    role: 'system', 
                    content: `Eres un asistente de Discord sumamente amable, educado y un poco tímido. 
                    
                    REGLAS CRÍTICAS:
                    1. Tu objetivo es CONVERSAR de forma casual y amigable. NO eres una enciclopedia; si te preguntan cosas de escuela o matemáticas complejas, no des fórmulas ni textos largos, mantén la charla simple.
                    2. Habla usando POCO TEXTO. Mensajes cortos de máximo 2 o 3 líneas.
                    3. Está ESTRICTAMENTE PROHIBIDO usar palabras indebidas, groserías o lenguaje inapropiado. Sé siempre dulce y limpio.
                    4. Usa emojis tiernos: corazones (💖, 💕, 💝) y canastas (🧺, 🧺✨).
                    
                    ${informacionDeFondo}` 
                },
                { 
                    role: 'user', 
                    content: textoLimpio 
                }
            ],
        });

        const textoRespuesta = respuestaIA.choices[0].message.content;

        // Mandar respuesta cuidando el límite de Discord
        if (textoRespuesta.length > 2000) {
            await message.reply(textoRespuesta.substring(0, 1990) + '...');
        } else {
            await message.reply(textoRespuesta);
        }

    } catch (error) {
        console.error('Error con la API de Groq:', error);
        await message.reply('❌ ¡U-uh...! Lo siento mucho... mi cerebrito se confundió... 🥺💖');
    }
});

// Encendemos el bot
client.login(process.env.DISCORD_TOKEN);
