require('dotenv').config();
const http = require('http');
const cron = require('node-cron');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');

// 1. Mini servidor HTTP para Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('¡El bot de Discord está activo y funcionando!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor HTTP escuchando en el puerto ${PORT}`);
});

// 2. Configuración del Bot con los Intents requeridos
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const CHANNEL_ID = '1499992706514948170';
const ROL_GHOST_PING_ID = '1530899659701227721';

// Almacenamiento en memoria para los días ocupados
let diasReclamados = {};
let mensajeCalendario = null; // Guardará la referencia al mensaje principal

const diasSemana = [
    { label: 'Lunes', value: 'lunes' },
    { label: 'Martes', value: 'martes' },
    { label: 'Miércoles', value: 'miercoles' },
    { label: 'Jueves', value: 'jueves' },
    { label: 'Viernes', value: 'viernes' },
    { label: 'Sábado', value: 'sabado' },
    { label: 'Domingo', value: 'domingo' }
];

// Función para construir el Embed
function construirEmbed() {
    let descripcion = '¿Como funciona? En el apartado de abajo selecciona un día para reclamarlo. Si un día ya está ocupado, aparecerá asignado a su respectivo usuario.\n\n**📅 Estado de la semana:**\n';

    for (const dia of diasSemana) {
        const usuarioId = diasReclamados[dia.value];
        if (usuarioId) {
            descripcion += `• **${dia.label}:** <@${usuarioId}>\n`;
        } else {
            descripcion += `• **${dia.label}:** 🟢 Disponible\n`;
        }
    }

    return new EmbedBuilder()
        .setTitle('**Calendario semanal de actividades**')
        .setDescription(descripcion)
        .setColor('#2F3136');
}

// Función para construir el Menú Desplegable
function construirMenu() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('calendario_menu')
        .setPlaceholder('Choco Opciones');

    for (const dia of diasSemana) {
        const estaOcupado = diasReclamados[dia.value];
        
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(estaOcupado ? `${dia.label} (Ocupado)` : dia.label)
                .setValue(dia.value)
                .setDescription(estaOcupado ? 'Este día ya no está disponible.' : 'Disponible para reclamar')
                .setEmoji(estaOcupado ? '🔒' : '📅')
        );
    }

    return new ActionRowBuilder().addComponents(menu);
}

// =================================================================
// FUNCIÓN PRINCIPAL DE REINICIO Y GHOST PING
// =================================================================
async function reiniciarCalendario() {
    console.log('🔄 Ejecutando reinicio de calendario...');

    // 1. Limpiar todos los días reclamados
    diasReclamados = {};

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) return console.error('No se encontró el canal especificado.');

        // 2. Si no tenemos referencia guardada del mensaje, la buscamos
        if (!mensajeCalendario) {
            const recentMessages = await channel.messages.fetch({ limit: 10 });
            mensajeCalendario = recentMessages.find(m => 
                m.author.id === client.user.id && 
                m.embeds.length > 0 && 
                m.embeds[0].title?.includes('Calendario semanal')
            );
        }

        // 3. Re-editar el mensaje para limpiar todos los puestos
        if (mensajeCalendario) {
            await mensajeCalendario.edit({ 
                embeds: [construirEmbed()], 
                components: [construirMenu()] 
            });
            console.log('✅ Calendario re-editado exitosamente.');
        } else {
            console.error('⚠️ No se encontró el mensaje del calendario para re-editar.');
        }

        // 4. Ghost Ping al Rol
        const pingMsg = await channel.send(`<@&${ROL_GHOST_PING_ID}>`);
        await pingMsg.delete();
        console.log('👻 Ghost Ping realizado correctamente.');

    } catch (error) {
        console.error('Error durante el reinicio del calendario:', error);
    }
}

client.once('ready', async () => {
    console.log(`¡Bot encendido y conectado como ${client.user.tag}!`);

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) return console.error('No se pudo encontrar el canal especificado.');

        // Busca si ya existe un mensaje previo del bot con el calendario
        const recentMessages = await channel.messages.fetch({ limit: 10 });
        mensajeCalendario = recentMessages.find(m => 
            m.author.id === client.user.id && 
            m.embeds.length > 0 && 
            m.embeds[0].title?.includes('Calendario semanal')
        );

        if (mensajeCalendario) {
            await mensajeCalendario.edit({ 
                embeds: [construirEmbed()], 
                components: [construirMenu()] 
            });
            console.log('¡Calendario previo encontrado y actualizado!');
        } else {
            mensajeCalendario = await channel.send({ 
                embeds: [construirEmbed()], 
                components: [construirMenu()] 
            });
            console.log('¡Nuevo mensaje de calendario enviado!');
        }

        // Programador Tarea Automática (Cron Job) - 12:00 AM GMT (00:00 UTC)
        cron.schedule('0 0 * * *', async () => {
            console.log('⏰ Hora programada alcanzada (12:00 AM GMT).');
            await reiniciarCalendario();
        }, {
            timezone: "Etc/UTC" // GMT / UTC
        });

    } catch (error) {
        console.error('Error al inicializar el bot o el canal:', error);
    }
});

// Listener para detectar el comando manual ".test"
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.trim() === '.test') {
        // Borra el mensaje .test enviado por el usuario
        try {
            await message.delete();
        } catch (err) {
            // Se ignora si no se tienen permisos para borrar mensajes en el canal
        }

        // Llama a la función de reinicio
        await reiniciarCalendario();
    }
});

// Listener para interacciones del menú desplegable
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'calendario_menu') return;

    const diaSeleccionado = interaction.values[0];
    const usuarioId = interaction.user.id;

    // 1. Validar si el usuario ya reclamó algún día esta semana
    if (Object.values(diasReclamados).includes(usuarioId)) {
        return interaction.reply({ 
            content: '❌ Ya has reclamado un día de la semana. Solo se permite un día por persona.', 
            flags: MessageFlags.Ephemeral 
        });
    }

    // 2. Validar si el día ya está ocupado por otra persona
    if (diasReclamados[diaSeleccionado]) {
        return interaction.reply({ 
            content: '❌ Este día ya ha sido reclamado por otra persona.', 
            flags: MessageFlags.Ephemeral 
        });
    }

    // 3. Reclamar el día
    diasReclamados[diaSeleccionado] = usuarioId;

    // 4. Actualizamos el mensaje original con el nuevo Embed y menú
    await interaction.update({ 
        embeds: [construirEmbed()], 
        components: [construirMenu()] 
    });

    // 5. Avisamos al usuario de forma privada
    await interaction.followUp({ 
        content: `✅ Has reclamado con éxito el día **${diaSeleccionado}**.`, 
        flags: MessageFlags.Ephemeral 
    });
});

client.login(process.env.DISCORD_TOKEN);
