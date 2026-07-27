require('dotenv').config();
const http = require('http');
const cron = require('node-cron');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

// 1. Mini servidor HTTP para Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('¡Bot de Calendario Activo!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT);

// 2. Configuración del Bot
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const CHANNEL_ID = '1499992706514948170';
const ROL_GHOST_PING_ID = '1530899659701227721';

let diasReclamados = {};
let mensajeCalendario = null;

const diasSemana = [
    { label: 'Lunes', value: 'lunes' },
    { label: 'Martes', value: 'martes' },
    { label: 'Miércoles', value: 'miercoles' },
    { label: 'Jueves', value: 'jueves' },
    { label: 'Viernes', value: 'viernes' },
    { label: 'Sábado', value: 'sabado' },
    { label: 'Domingo', value: 'domingo' }
];

// Generar los dos Embeds
function construirEmbeds() {
    let descripcion = 'ꕀ ﹒ ¿Cómo funciona? \nEn el apartado de abajo selecciona un día para reclamarlo, esto es una organizacion para las actividades semanales.\n\n';

    for (const dia of diasSemana) {
        const usuarioId = diasReclamados[dia.value];
        descripcion += `⤷ ${dia.label} ﹕ ${usuarioId ? `<@${usuarioId}>` : '🟢 Disponible'}\n`;
    }

    const embedPrincipal = new EmbedBuilder()
        .setTitle('ⳋৎㅤ︵ㅤCalendario semanal de actividadesㅤ.ᐟ')
        .setDescription(descripcion)
        .setColor('#2F3136');

    const embedCancelar = new EmbedBuilder()
        .setDescription('**¿Deseas cancelar tu actividad?**\nSi ya habías reclamado un día y quieres liberarlo, presiona el botón de abajo.')
        .setColor('#ED4245'); // Color rojo

    return [embedPrincipal, embedCancelar];
}

// Generar los componentes (Menú y Botón)
function construirComponentes() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('calendario_menu')
        .setPlaceholder('Choco Opciones')
        .addOptions(diasSemana.map(dia => {
            const ocupado = diasReclamados[dia.value];
            return new StringSelectMenuOptionBuilder()
                .setLabel(ocupado ? `${dia.label} (Ocupado)` : dia.label)
                .setValue(dia.value)
                .setEmoji(ocupado ? '🔒' : '📅');
        }));

    const botonCancelar = new ButtonBuilder()
        .setCustomId('cancelar_actividad')
        .setLabel('Cancelar Selección')
        .setEmoji('✖️')
        .setStyle(ButtonStyle.Danger);

    return [
        new ActionRowBuilder().addComponents(menu),
        new ActionRowBuilder().addComponents(botonCancelar)
    ];
}

async function actualizarMensaje() {
    if (mensajeCalendario) {
        await mensajeCalendario.edit({
            embeds: construirEmbeds(),
            components: construirComponentes()
        });
    }
}

client.once('ready', async () => {
    console.log(`Bot listo: ${client.user.tag}`);
    const channel = await client.channels.fetch(CHANNEL_ID);
    
    // Buscar mensaje previo para no repetir
    const recent = await channel.messages.fetch({ limit: 10 });
    mensajeCalendario = recent.find(m => m.author.id === client.user.id && m.embeds.length > 0);

    if (!mensajeCalendario) {
        mensajeCalendario = await channel.send({ embeds: construirEmbeds(), components: construirComponentes() });
    } else {
        await actualizarMensaje();
    }

    // Cron a las 12:00 AM GMT
    cron.schedule('0 0 * * *', async () => {
        diasReclamados = {};
        await actualizarMensaje();
        const ghost = await channel.send(`<@&${ROL_GHOST_PING_ID}>`);
        await ghost.delete();
    }, { timezone: "Etc/UTC" });
});

client.on('interactionCreate', async interaction => {
    // MANEJO DEL MENÚ (RECLAMAR)
    if (interaction.isStringSelectMenu() && interaction.customId === 'calendario_menu') {
        const dia = interaction.values[0];
        const user = interaction.user.id;

        if (Object.values(diasReclamados).includes(user)) {
            return interaction.reply({ content: '❌ Ya tienes un día asignado. Cancela primero para elegir otro.', flags: MessageFlags.Ephemeral });
        }
        if (diasReclamados[dia]) {
            return interaction.reply({ content: '❌ Este día ya está ocupado.', flags: MessageFlags.Ephemeral });
        }

        diasReclamados[dia] = user;
        await interaction.update({ embeds: construirEmbeds(), components: construirComponentes() });
    }

    // MANEJO DEL BOTÓN (CANCELAR)
    if (interaction.isButton() && interaction.customId === 'cancelar_actividad') {
        const user = interaction.user.id;
        // Buscar qué día tiene este usuario
        const diaOcupado = Object.keys(diasReclamados).find(key => diasReclamados[key] === user);

        if (!diaOcupado) {
            return interaction.reply({ content: '❌ No tienes ningún día reclamado para cancelar.', flags: MessageFlags.Ephemeral });
        }

        delete diasReclamados[diaOcupado]; // Liberar el día
        await interaction.update({ embeds: construirEmbeds(), components: construirComponentes() });
        await interaction.followUp({ content: '✅ Has liberado tu día correctamente.', flags: MessageFlags.Ephemeral });
    }
});

// Comando .test manual
client.on('messageCreate', async m => {
    if (m.content === '.test' && !m.author.bot) {
        diasReclamados = {};
        await actualizarMensaje();
        const ghost = await m.channel.send(`<@&${ROL_GHOST_PING_ID}>`);
        await ghost.delete();
        try { await m.delete(); } catch(e){}
    }
});

client.login(process.env.DISCORD_TOKEN);
