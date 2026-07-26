require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const CHANNEL_ID = '1499992706514948170';

// Almacenamiento temporal en memoria para los días ocupados
const diasReclamados = {};

const diasSemana = [
    { label: 'Lunes', value: 'lunes' },
    { label: 'Martes', value: 'martes' },
    { label: 'Miércoles', value: 'miercoles' },
    { label: 'Jueves', value: 'jueves' },
    { label: 'Viernes', value: 'viernes' },
    { label: 'Sábado', value: 'sabado' },
    { label: 'Domingo', value: 'domingo' }
];

// Función para generar el Embed con el estado actual de los días
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

// Función para generar el menú desplegable actualizado
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

client.once('ready', async () => {
    console.log(`¡Bot encendido y conectado como ${client.user.tag}!`);

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) return console.error('No se pudo encontrar el canal especificado.');

        // Enviamos el mensaje inicial con el embed y el menú
        await channel.send({ 
            embeds: [construirEmbed()], 
            components: [construirMenu()] 
        });
        
        console.log('¡Calendario enviado exitosamente al canal configurado!');

    } catch (error) {
        console.error('Error al enviar el calendario al iniciar:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'calendario_menu') return;

    const diaSeleccionado = interaction.values[0];
    const usuarioId = interaction.user.id;

    // 1. Validar si el usuario ya reclamó algún día esta semana
    if (Object.values(diasReclamados).includes(usuarioId)) {
        return interaction.reply({ 
            content: '❌ Ya has reclamado un día de la semana. Solo se permite un día por persona.', 
            ephemeral: true 
        });
    }

    // 2. Validar si el día ya está ocupado por otra persona
    if (diasReclamados[diaSeleccionado]) {
        return interaction.reply({ 
            content: '❌ Este día ya ha sido reclamado por otra persona.', 
            ephemeral: true 
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
        ephemeral: true 
    });
});

// Inicia sesión usando la variable de entorno configurada en Render
client.login(process.env.DISCORD_TOKEN);
