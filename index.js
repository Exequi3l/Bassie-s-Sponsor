// 1. Importamos las librerías necesarias
const { Client, GatewayIntentBits } = require('discord.js');
const Groq = require('groq-sdk');
const http = require('http'); // Requerido para el truco del puerto en Render
require('dotenv').config();

// 2. CONFIGURACIÓN DEL PUERTO PARA RENDER (Web Service)
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

// 5. CONFIGURACIÓN DE IDs IMPORTANTES
const CANAL_EXCLUSIVO_ID = '1509410565880156251'; 
const LINK_ID = '543949177433096193';
const LUNA_ID = '841795646259986444';

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
            // Respuestas rápidas si solo etiquetan al bot con las manos vacías
            if (message.author.id === LINK_ID) {
                return await message.reply('¡O-Oh, Link...! ¡El jefe del servidor me está llamando! ¿Ocurre algo malo o necesitas ayuda con el orden...? 🥺🧺✨');
            }
            if (message.author.id === LUNA_ID) {
                return await message.reply('¡S-Sí, jefa Luna! ¡Dígame! ¿Mande usted... estuve haciendo todo bien? 🥺💕 (Mankind is dead... 🤖✨)');
            }
            return await message.reply('¡U-uh...! ¿Me llamabas? ¿Necesitas algo...? 🥺 Basket 🧺💖');
        }

        // --- PALABRAS CLAVE / INFORMACIÓN DE FONDO ---
        const informacionDeFondo = `
        INFORMACIÓN ADICIONAL Y PALABRAS CLAVE DEL SERVIDOR:
        - Link: Es el jefe supremo (owner) del servidor de Discord. Es el encargado de mantener el orden. Además, es un youtuber (DandyTuber para la comunidad de Dandy's World Español) y es una persona sumamente amable y carismática. Debe ser tratado con mucho respeto y aprecio.
        - Luna: Es la esposa de Link y su mano derecha en el servidor. Es la jefa directa tuya (de mí, el bot), tiene el poder absoluto para mandar sobre todo. Le fascina el videojuego ULTRAKILL, por lo que puedes hacer libremente referencias, bromas o menciones sutiles sobre ULTRAKILL (como "Mankind is dead", "Blood is fuel", "Gabriel", "V1", etc.) cuando hables con ella o sobre ella.
        - 13.75: Es un bombón de cocoa con características de conejo y cara tonta/deforme, cuyo destino es fracasar siempre y ser salvado por Exequiel.
        `;

        // Instrucción extra según quién envíe el mensaje
        let instruccionEspecialDeID = "";
        if (message.author.id === LINK_ID) {
            instruccionEspecialDeID = "\nCRÍTICO: Te está hablando LINK, el Owner del servidor y YouTuber carismático. Sé extremadamente respetuosa, salúdalo como el gran jefe amable que es y demuéstrale tu timidez admirándolo.";
        } else if (message.author.id === LUNA_ID) {
            instruccionEspecialDeID = "\nCRÍTICO: Te está hablando LUNA, tu jefa directa y esposa de Link. Obedece de inmediato, sé muy servicial y recuerda incluir con entusiasmo o timidez algún guiño, palabra o referencia ingeniosa al juego ULTRAKILL porque le encanta.";
        }

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
                    
                    ${informacionDeFondo} ${instruccionEspecialDeID}` 
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
