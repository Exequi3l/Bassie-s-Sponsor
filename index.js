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

client.once('ready', async () => {
    console.log(`¡Bot encendido y conectado como ${client.user.tag}!`);

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) return console.error('No se pudo encontrar el canal especificado.');

        // 1. Creamos el Embed
        const embed = new EmbedBuilder()
            .setTitle('**Calendario semanal de actividades**')
            .setDescription('¿Como funciona? En el apartado de abajo aparecerá una interfaz de botones que te desplazara a todos los días (similar a lo de tickets), en donde si un día estará ocupado, este no podrás reclamarlo.')
            .setColor('#2F3136');

        // 2. Creamos el Menú Desplegable con el nombre "Choco Opciones"
        const menu = new StringSelectMenuBuilder()
            .setCustomId('calendario_menu')
            .setPlaceholder('Choco Opciones')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Lunes').setValue('lunes').setDescription('Disponible para reclamar').setEmoji('📅'),
                new StringSelectMenuOptionBuilder().setLabel('Martes').setValue('martes').setDescription('Disponible para reclamar').setEmoji('📅'),
                new StringSelectMenuOptionBuilder().setLabel('Miércoles').setValue('miercoles').setDescription('Disponible para reclamar').setEmoji('📅'),
                new StringSelectMenuOptionBuilder().setLabel('Jueves').setValue('jueves').setDescription('Disponible para reclamar').setEmoji('📅'),
                new StringSelectMenuOptionBuilder().setLabel('Viernes').setValue('viernes').setDescription('Disponible para reclamar').setEmoji('📅'),
                new StringSelectMenuOptionBuilder().setLabel('Sábado').setValue('sabado').setDescription('Disponible para reclamar').setEmoji('📅'),
                new StringSelectMenuOptionBuilder().setLabel('Domingo').setValue('domingo').setDescription('Disponible para reclamar').setEmoji('📅'),
            );

        const row = new ActionRowBuilder().addComponents(menu);

        // 3. Enviamos el mensaje al canal configurado
        await channel.send({ embeds: [embed], components: [row] });
        console.log('¡Calendario enviado exitosamente al canal configurado!');

    } catch (error) {
        console.error('Error al enviar el calendario al iniciar:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'calendario_menu') return;

    const diaSeleccionado = interaction.values[0];
    const usuarioId = interaction.user.id;

    // 1. Validar si el día ya está ocupado
    if (diasReclamados[diaSeleccionado]) {
        return interaction.reply({ 
            content: '❌ Este día ya ha sido reclamado por otra persona.', 
            ephemeral: true 
        });
    }

    // 2. Reclamar el día
    diasReclamados[diaSeleccionado] = usuarioId;

    // 3. Reconstruir el menú para actualizar visualmente qué días están ocupados
    const diasSemana = [
        { label: 'Lunes', value: 'lunes' },
        { label: 'Martes', value: 'martes' },
        { label: 'Miércoles', value: 'miercoles' },
        { label: 'Jueves', value: 'jueves' },
        { label: 'Viernes', value: 'viernes' },
        { label: 'Sábado', value: 'sabado' },
        { label: 'Domingo', value: 'domingo' }
    ];

    const menuActualizado = new StringSelectMenuBuilder()
        .setCustomId('calendario_menu')
        .setPlaceholder('Choco Opciones');

    for (const dia of diasSemana) {
        const estaOcupado = diasReclamados[dia.value];
        
        menuActualizado.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(estaOcupado ? `${dia.label} ❌ (Ocupado)` : dia.label)
                .setValue(dia.value)
                .setDescription(estaOcupado ? 'Este día ya no está disponible.' : 'Disponible para reclamar')
                .setEmoji(estaOcupado ? '🔒' : '📅')
        );
    }

    const rowActualizada = new ActionRowBuilder().addComponents(menuActualizado);

    // 4. Actualizamos el mensaje original con el nuevo menú
    await interaction.update({ components: [rowActualizada] });

    // 5. Avisamos al usuario de forma privada
    await interaction.followUp({ 
        content: `✅ Has reclamado con éxito el día **${diaSeleccionado}**.`, 
        ephemeral: true 
    });
});

// Inicia sesión usando la variable de entorno configurada en Render
client.login(process.env.DISCORD_TOKEN);
