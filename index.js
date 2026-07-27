require('dotenv').config();
const http = require('http');
const cron = require('node-cron');
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags 
} = require('discord.js');

// 1. Mini servidor HTTP para Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('¡Bot de Calendario Activo!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor HTTP escuchando en el puerto ${PORT}`);
});

// 2. Configuración del Bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const CHANNEL_ID = '1499992706514948170';
const ROL_GHOST_PING_ID = '1530899659701227721';
const ROL_ACTIVIDADES_LIBRES_ID = '1531098555538866277';

let diasReclamados = {};
let mensajeCalendario = null;

// Control de actividades y temporizadores
let actividadSufrimientoConfirmada = false;
let temporizadorSufrimiento = null;

let actividadPreguntaConfirmada = false;
let temporizadorPregunta = null;

const diasSemana = [
    { label: 'Lunes', value: 'lunes' },
    { label: 'Martes', value: 'martes' },
    { label: 'Miércoles', value: 'miercoles' },
    { label: 'Jueves', value: 'jueves' },
    { label: 'Viernes', value: 'viernes' },
    { label: 'Sábado', value: 'sabado' },
    { label: 'Domingo', value: 'domingo' }
];

// Generar los 3 Embeds principales
function construirEmbeds() {
    let descripcion = 'ꕀ ﹒ ¿Cómo funciona? \nEn el apartado de abajo selecciona un día para reclamarlo, esto es una organizacion para las actividades semanales. Si un día ya está ocupado aparecerá asignado a su respectivo usuario.\n\n';

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
        .setColor('#ED4245');

    const embedRol = new EmbedBuilder()
        .setDescription(`**Rol Actividades Libres**\nPresiona el botón de abajo para obtener o quitarte el rol <@&${ROL_ACTIVIDADES_LIBRES_ID}> y recibir avisos si una actividad queda disponible.`)
        .setColor('#5865F2');

    return [embedPrincipal, embedCancelar, embedRol];
}

// Generar los botones y el menú desplegable
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

    const botonRol = new ButtonBuilder()
        .setCustomId('toggle_rol_libres')
        .setLabel('Obtener Rol Actividades Libres')
        .setEmoji('🔔')
        .setStyle(ButtonStyle.Primary);

    return [
        new ActionRowBuilder().addComponents(menu),
        new ActionRowBuilder().addComponents(botonCancelar, botonRol)
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

// =================================================================
// RECORDATORIO 1: SUFRIMIENTO DEL DÍA (15 Minutos de espera)
// =================================================================
async function enviarRecordatorioSufrimiento(channel, diaValor, usuarioId) {
    const diaObjeto = diasSemana.find(d => d.value === diaValor);
    const nombreDia = diaObjeto ? diaObjeto.label : 'Hoy';

    actividadSufrimientoConfirmada = false;

    const botonIndicio = new ButtonBuilder()
        .setCustomId('indicio_actividad_sufrimiento')
        .setLabel('Dar Indicio de Actividad')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(botonIndicio);

    const mensajeRecordatorio = await channel.send({
        content: `# Sufrimiento del día **${nombreDia}**\nPsss oye <@${usuarioId}>\nAquí tienes un pequeño recordatorio de que tienes que hacer el <#${CHANNEL_ID}> en unos 5 minutos, recuerda que si te demoras 15 minutos, otro miembro del staff lo hará por tí.`,
        components: [row]
    });

    if (temporizadorSufrimiento) clearTimeout(temporizadorSufrimiento);

    // 15 Minutos = 15 * 60 * 1000 ms
    const TIEMPO_ESPERA_MS = 15 * 60 * 1000;

    temporizadorSufrimiento = setTimeout(async () => {
        if (!actividadSufrimientoConfirmada) {
            try {
                botonIndicio.setDisabled(true);
                await mensajeRecordatorio.edit({ components: [new ActionRowBuilder().addComponents(botonIndicio)] });
            } catch (err) {}

            await enviarAlertaActividadesLibres(channel);
        }
    }, TIEMPO_ESPERA_MS);
}

// =================================================================
// RECORDATORIO 2: PREGUNTA Y GUSTOS DÍA (1 Hora de espera)
// =================================================================
async function enviarRecordatorioPregunta(channel, diaValor, usuarioId) {
    const diaObjeto = diasSemana.find(d => d.value === diaValor);
    const nombreDia = diaObjeto ? diaObjeto.label : 'Hoy';

    actividadPreguntaConfirmada = false;

    const botonIndicio = new ButtonBuilder()
        .setCustomId('indicio_actividad_pregunta')
        .setLabel('Dar Indicio de Actividad')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(botonIndicio);

    const mensajeRecordatorio = await channel.send({
        content: `# Pregunta y Gustos día **${nombreDia}**\nSaludos, momento de un pequeño recordatorio: \n> Buenos días <@${usuarioId}> Recuerda que esta es la hora en la que tienes que hacer la <#${CHANNEL_ID}> el día de hoy.\nAdemás, <@${usuarioId}> el día de hoy te toca hacer la encuesta de <#${CHANNEL_ID}> , por lo que es mejor que pienses que vas a colocar.\nRecuerden que si se demoran una hora, otros miembros del staff lo harán por ustedes.`,
        components: [row]
    });

    if (temporizadorPregunta) clearTimeout(temporizadorPregunta);

    // 1 Hora = 60 * 60 * 1000 ms
    const TIEMPO_ESPERA_MS = 60 * 60 * 1000;

    temporizadorPregunta = setTimeout(async () => {
        if (!actividadPreguntaConfirmada) {
            try {
                botonIndicio.setDisabled(true);
                await mensajeRecordatorio.edit({ components: [new ActionRowBuilder().addComponents(botonIndicio)] });
            } catch (err) {}

            await enviarAlertaActividadesLibres(channel);
        }
    }, TIEMPO_ESPERA_MS);
}

// Función auxiliar para emitir la alerta de Actividades Libres
async function enviarAlertaActividadesLibres(channel) {
    const botonReclamar = new ButtonBuilder()
        .setCustomId('reclamar_actividad_libre')
        .setLabel('Reclamar Actividad')
        .setEmoji('🙋‍♂️')
        .setStyle(ButtonStyle.Primary);

    await channel.send({
        content: `# <@&${ROL_ACTIVIDADES_LIBRES_ID}>\n> Hay una actividad disponible que el usuario no ha dado indicio de actividad para realizarla. ¡Por favor apreté el botón debajo para así reclamarla!`,
        components: [new ActionRowBuilder().addComponents(botonReclamar)]
    });
}

// =================================================================
// EVENTOS DEL CLIENTE Y PROGRAMACIONES CRON
// =================================================================
client.once('ready', async () => {
    console.log(`Bot conectado como ${client.user.tag}`);
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) return;

        const recent = await channel.messages.fetch({ limit: 10 });
        mensajeCalendario = recent.find(m => m.author.id === client.user.id && m.embeds.length > 0);

        if (!mensajeCalendario) {
            mensajeCalendario = await channel.send({ embeds: construirEmbeds(), components: construirComponentes() });
        } else {
            await actualizarMensaje();
        }

        const diasNombreUTC = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

        // CRON 1: 12:00 AM UTC (00:00) -> Sufrimiento del Día
        cron.schedule('0 0 * * *', async () => {
            const diaHoy = diasNombreUTC[new Date().getUTCDay()];

            // Ghost Ping
            const ghost = await channel.send(`<@&${ROL_GHOST_PING_ID}>`);
            await ghost.delete();

            if (diasReclamados[diaHoy]) {
                await enviarRecordatorioSufrimiento(channel, diaHoy, diasReclamados[diaHoy]);
            }
        }, { timezone: "Etc/UTC" });

        // CRON 2: 4:00 PM UTC (16:00) -> Pregunta y Gustos día
        cron.schedule('0 16 * * *', async () => {
            const diaHoy = diasNombreUTC[new Date().getUTCDay()];

            if (diasReclamados[diaHoy]) {
                await enviarRecordatorioPregunta(channel, diaHoy, diasReclamados[diaHoy]);
            }
        }, { timezone: "Etc/UTC" });

    } catch (e) {
        console.error('Error en evento ready:', e);
    }
});

// Listener de interacciones (Menús y Botones)
client.on('interactionCreate', async interaction => {
    
    // 1. SELECCIÓN DE DÍA (Menú Desplegable)
    if (interaction.isStringSelectMenu() && interaction.customId === 'calendario_menu') {
        const dia = interaction.values[0];
        const user = interaction.user.id;

        if (Object.values(diasReclamados).includes(user)) {
            return interaction.reply({ content: '❌ Ya tienes un día asignado. Cancela primero para elegir otro.', flags: MessageFlags.Ephemeral });
        }
        if (diasReclamados[dia]) {
            return interaction.reply({ content: '❌ Este día ya está ocupado por otra persona.', flags: MessageFlags.Ephemeral });
        }

        diasReclamados[dia] = user;
        await interaction.update({ embeds: construirEmbeds(), components: construirComponentes() });
    }

    // 2. CANCELAR SELECCIÓN
    if (interaction.isButton() && interaction.customId === 'cancelar_actividad') {
        const user = interaction.user.id;
        const diaOcupado = Object.keys(diasReclamados).find(key => diasReclamados[key] === user);

        if (!diaOcupado) {
            return interaction.reply({ content: '❌ No tienes ningún día reclamado para cancelar.', flags: MessageFlags.Ephemeral });
        }

        delete diasReclamados[diaOcupado];
        await interaction.update({ embeds: construirEmbeds(), components: construirComponentes() });
        await interaction.followUp({ content: '✅ Has liberado tu día correctamente.', flags: MessageFlags.Ephemeral });
    }

    // 3. TOGGLE ROL ACTIVIDADES LIBRES
    if (interaction.isButton() && interaction.customId === 'toggle_rol_libres') {
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (member.roles.cache.has(ROL_ACTIVIDADES_LIBRES_ID)) {
                await member.roles.remove(ROL_ACTIVIDADES_LIBRES_ID);
                return interaction.reply({ content: '🔔 Se te ha **retirado** el rol de Actividades Libres.', flags: MessageFlags.Ephemeral });
            } else {
                await member.roles.add(ROL_ACTIVIDADES_LIBRES_ID);
                return interaction.reply({ content: '✅ Se te ha **otorgado** el rol de Actividades Libres.', flags: MessageFlags.Ephemeral });
            }
        } catch (err) {
            console.error('Error al gestionar rol:', err);
            return interaction.reply({ content: '❌ Ocurrió un error al intentar cambiar el rol. Revisa los permisos del bot.', flags: MessageFlags.Ephemeral });
        }
    }

    // 4. INDICIO DE ACTIVIDAD (Sufrimiento o Pregunta y Gustos)
    if (interaction.isButton() && (interaction.customId === 'indicio_actividad_sufrimiento' || interaction.customId === 'indicio_actividad_pregunta')) {
        if (interaction.customId === 'indicio_actividad_sufrimiento') {
            actividadSufrimientoConfirmada = true;
            if (temporizadorSufrimiento) clearTimeout(temporizadorSufrimiento);
        } else {
            actividadPreguntaConfirmada = true;
            if (temporizadorPregunta) clearTimeout(temporizadorPregunta);
        }

        await interaction.reply({ content: '✅ Has dado indicio de actividad correctamente. ¡Éxito!', flags: MessageFlags.Ephemeral });
        
        try {
            const botonDeshabilitado = new ButtonBuilder()
                .setCustomId(interaction.customId)
                .setLabel('Actividad Confirmada')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true);

            await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(botonDeshabilitado)] });
        } catch (e) {}
    }

    // 5. RECLAMAR ACTIVIDAD LIBRE
    if (interaction.isButton() && interaction.customId === 'reclamar_actividad_libre') {
        await interaction.reply({ content: `✅ <@${interaction.user.id}> ha reclamado la actividad libre.` });

        try {
            const botonReclamado = new ButtonBuilder()
                .setCustomId('reclamar_actividad_libre')
                .setLabel(`Reclamado por ${interaction.user.username}`)
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(botonReclamado)] });
        } catch (e) {}
    }
});

// =================================================================
// COMANDOS DE TESTEO
// =================================================================
client.on('messageCreate', async m => {
    if (m.author.bot) return;
    const cmd = m.content.trim().toLowerCase();

    // .test -> Reiniciar calendario + Ghost Ping
    if (cmd === '.test') {
        try { await m.delete(); } catch(e){}

        diasReclamados = {};
        await actualizarMensaje();

        const ghost = await m.channel.send(`<@&${ROL_GHOST_PING_ID}>`);
        await ghost.delete();
    }

    // .test1 -> Prueba recordatorio "Sufrimiento del día" (15 min espera)
    if (cmd === '.test1') {
        try { await m.delete(); } catch(e){}

        const usuarioPrueba = m.author.id;
        await enviarRecordatorioSufrimiento(m.channel, 'lunes', usuarioPrueba);
    }

    // .test2 -> Prueba alerta "Actividades Libres"
    if (cmd === '.test2') {
        try { await m.delete(); } catch(e){}

        await enviarAlertaActividadesLibres(m.channel);
    }

    // .test4 -> Prueba recordatorio "Pregunta y Gustos día" (1 hora espera)
    if (cmd === '.test4') {
        try { await m.delete(); } catch(e){}

        const usuarioPrueba = m.author.id;
        await enviarRecordatorioPregunta(m.channel, 'lunes', usuarioPrueba);
    }
});

client.login(process.env.DISCORD_TOKEN);
