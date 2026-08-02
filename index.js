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

// 1. Mini servidor HTTP para mantener activo en Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('¡Bot de Calendario Activo!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor HTTP escuchando en el puerto ${PORT}`);
});

// 2. Configuración del Bot e IDs de Canales / Roles
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ID de canales
const CANAL_CALENDARIO_ID = '1533254417065840702'; 
const CANAL_AVISOS_ID = '1380321494298792147';       
const CANAL_SUFRIMIENTO_ID = '1372697602985955388';
const CANAL_ACTIVIDAD_GUSTOS_ID = '1444430795329503263';
const CANAL_ENCUESTA_GUSTOS_ID = '1514030783902519316';
const CANAL_PREGUNTA_DIA_ID = 'ID_DEL_CANAL_DE_PREGUNTAS'; // 👈 RECUERDA CAMBIAR ESTO

// ID de rol de Staff
const ROL_STAFF_ID = '1531150257210003456';

// Control de días por actividad
let diasReclamados = {
    pregunta: {},
    gustos: {},
    sufrimiento: {}
};

let mensajeCalendario = null; 

let actividadSufrimientoConfirmada = false;
let temporizadorSufrimiento = null;

// Control SEPARADO para Gustos y Preguntas
let actividadPreguntaConfirmada = false;
let actividadGustosConfirmada = false;
let temporizadorGustosPregunta = null;

const diasSemana = [
    { label: 'Lunes', value: 'lunes' },
    { label: 'Martes', value: 'martes' },
    { label: 'Miércoles', value: 'miercoles' },
    { label: 'Jueves', value: 'jueves' },
    { label: 'Viernes', value: 'viernes' },
    { label: 'Sábado', value: 'sabado' },
    { label: 'Domingo', value: 'domingo' }
];

// Función auxiliar para generar las listas por actividad
function generarListaDias(actividad) {
    let lista = '';
    for (const dia of diasSemana) {
        const usuarioId = diasReclamados[actividad][dia.value];
        lista += `⤷ ${dia.label} ﹕ ${usuarioId ? `<@${usuarioId}>` : '🟢 Disponible'}\n`;
    }
    return lista;
}

// Generar los 5 Embeds
function construirEmbeds() {
    const descripcionInfo = '**E**n el apartado de abajo selecciona un día para reclamarlo, esto es una organización para las actividades semanales. \n**S**i un día ya está ocupado aparecerá asignado a su respectivo usuario.';

    const embedInfo = new EmbedBuilder()
        .setTitle('ৎㅤ︵ㅤCalendario semanal de actividadesㅤ.ᐟ')
        .setDescription(descripcionInfo)
        .setColor('#3498DB')
        .setThumbnail('https://i.imgur.com/DRwb1jR.png');

    const embedPregunta = new EmbedBuilder()
        .setTitle('❓ Pregunta del Día')
        .setDescription(generarListaDias('pregunta'))
        .setColor('#5865F2');

    const embedGustos = new EmbedBuilder()
        .setTitle('🧺 Gustos Canastosos')
        .setDescription(generarListaDias('gustos'))
        .setColor('#F1C40F'); 

    const embedSufrimiento = new EmbedBuilder()
        .setTitle('📭 Sufrimiento del Día')
        .setDescription(generarListaDias('sufrimiento'))
        .setColor('#E74C3C'); 

    const embedCancelar = new EmbedBuilder()
        .setDescription('**¿Deseas cancelar tu actividad?**\nSi ya habías reclamado un día y quieres liberarlo, presiona el botón de la actividad correspondiente abajo.')
        .setColor('#2F3136'); 

    return [embedInfo, embedPregunta, embedGustos, embedSufrimiento, embedCancelar];
}

function crearMenu(actividad, customId, placeholder) {
    return new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .addOptions(diasSemana.map(dia => {
            const ocupado = diasReclamados[actividad][dia.value];
            return new StringSelectMenuOptionBuilder()
                .setLabel(ocupado ? `${dia.label} (Ocupado)` : dia.label)
                .setValue(dia.value)
                .setEmoji(ocupado ? '🔒' : '📅');
        }));
}

function construirComponentes() {
    const menuPregunta = crearMenu('pregunta', 'calendario_pregunta', '❓ Elegir día para Pregunta');
    const menuGustos = crearMenu('gustos', 'calendario_gustos', '🧺 Elegir día para Gustos');
    const menuSufrimiento = crearMenu('sufrimiento', 'calendario_sufrimiento', '📭 Elegir día para Sufrimiento');

    const btnCancelPregunta = new ButtonBuilder().setCustomId('cancelar_pregunta').setLabel('Cancelar Pregunta').setEmoji('✖️').setStyle(ButtonStyle.Danger);
    const btnCancelGustos = new ButtonBuilder().setCustomId('cancelar_gustos').setLabel('Cancelar Gustos').setEmoji('✖️').setStyle(ButtonStyle.Danger);
    const btnCancelSufrimiento = new ButtonBuilder().setCustomId('cancelar_sufrimiento').setLabel('Cancelar Sufrimiento').setEmoji('✖️').setStyle(ButtonStyle.Danger);

    return [
        new ActionRowBuilder().addComponents(menuPregunta),
        new ActionRowBuilder().addComponents(menuGustos),
        new ActionRowBuilder().addComponents(menuSufrimiento),
        new ActionRowBuilder().addComponents(btnCancelPregunta, btnCancelGustos, btnCancelSufrimiento)
    ];
}

async function actualizarMensaje() {
    if (mensajeCalendario) {
        await mensajeCalendario.edit({
            embeds: construirEmbeds(),
            components: construirComponentes()
        }).catch(console.error);
    }
}

// =================================================================
// 1. RECORDATORIO: SUFRIMIENTO DEL DÍA (15 Minutos)
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

    const botonTransferir = new ButtonBuilder()
        .setCustomId('transferir_sufrimiento')
        .setLabel('Transferir Actividad')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(botonIndicio, botonTransferir);

    const mensajeRecordatorio = await channel.send({
        content: `# Sufrimiento del día **${nombreDia}** <:sufrimiento:1486794952674644019>\nPsss oye <@${usuarioId}>\nAquí tienes un pequeño recordatorio de que tienes que hacer el <#${CANAL_SUFRIMIENTO_ID}> en unos 5 minutos, recuerda que si te demoras 15 minutos, puedes transferir la actividad o de lo contrario el sistema alertará al staff automáticamente.`,
        components: [row]
    });

    if (temporizadorSufrimiento) clearTimeout(temporizadorSufrimiento);
    const TIEMPO_15_MINUTOS = 15 * 60 * 1000;

    temporizadorSufrimiento = setTimeout(async () => {
        if (!actividadSufrimientoConfirmada) {
            try {
                botonIndicio.setDisabled(true);
                botonTransferir.setDisabled(true);
                await mensajeRecordatorio.edit({ components: [new ActionRowBuilder().addComponents(botonIndicio, botonTransferir)] });
            } catch (err) {}
            await enviarAlertaActividadesLibres(channel); 
        }
    }, TIEMPO_15_MINUTOS);
}

// =================================================================
// 2. RECORDATORIO: PREGUNTA Y GUSTOS (Mensajes Separados - 1 Hora)
// =================================================================
async function enviarRecordatoriosGP(channel, diaValor) {
    const diaObjeto = diasSemana.find(d => d.value === diaValor);
    const nombreDia = diaObjeto ? diaObjeto.label : 'Hoy';
    
    const usuarioPregunta = diasReclamados.pregunta[diaValor];
    const usuarioGustos = diasReclamados.gustos[diaValor];

    actividadPreguntaConfirmada = false;
    actividadGustosConfirmada = false;
    
    let mensajePregunta = null;
    let mensajeGustos = null;

    // Caso 1: Nadie reclamó absolutamente nada
    if (!usuarioPregunta && !usuarioGustos) {
        return await enviarAlertaInactividadGP(channel, true, true);
    }

    // --- MENSAJE 1: PREGUNTA DEL DÍA ---
    if (usuarioPregunta) {
        const rowP = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('indicio_gp_pregunta').setLabel('Dar Indicio de Actividad').setEmoji('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('transferir_gp_pregunta').setLabel('Transferir Actividad').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
        );
        mensajePregunta = await channel.send({
            content: `# Pregunta del día ${nombreDia} <:pregunta:1495172170748399777>\n> Buenos días <@${usuarioPregunta}> ¡recuerda que este es el horario para realizar la <#${CANAL_PREGUNTA_DIA_ID}> del día de hoy!\n**Recuerden que solo cuentan con 1 hora para realizar la actividad; en caso contrario se le dará a la primera persona que reclame.**`,
            components: [rowP]
        });
    } else {
        // Si nadie reclamó Pregunta pero sí Gustos, enviamos la alerta de la pregunta de inmediato
        await enviarAlertaInactividadGP(channel, true, false);
        actividadPreguntaConfirmada = true; // Se auto-confirma para que el temporizador no la vuelva a alertar
    }

    // --- MENSAJE 2: GUSTOS CANASTOSOS ---
    if (usuarioGustos) {
        const rowG = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('indicio_gp_gustos').setLabel('Dar Indicio de Actividad').setEmoji('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('transferir_gp_gustos').setLabel('Transferir Actividad').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
        );
        mensajeGustos = await channel.send({
            content: `# Gustos Canastosos Día ${nombreDia} <:canasta:1494335819702341793>\nAdemás <@${usuarioGustos}> deberá realizar la encuesta de <#${CANAL_ENCUESTA_GUSTOS_ID}>, ¡así que te recomiendo pensar qué vas a colocar allí!\n**Recuerden que solo cuentan con 1 hora para realizar la actividad; en caso contrario se le dará a la primera persona que reclame.**`,
            components: [rowG]
        });
    } else {
        // Si nadie reclamó Gustos pero sí Pregunta
        await enviarAlertaInactividadGP(channel, false, true);
        actividadGustosConfirmada = true; 
    }

    // INICIO DEL TEMPORIZADOR CONJUNTO (1 HORA)
    if (temporizadorGustosPregunta) clearTimeout(temporizadorGustosPregunta);
    const TIEMPO_1_HORA = 60 * 60 * 1000;

    temporizadorGustosPregunta = setTimeout(async () => {
        let faltaPregunta = usuarioPregunta && !actividadPreguntaConfirmada;
        let faltaGustos = usuarioGustos && !actividadGustosConfirmada;

        // Deshabilitar botones de Pregunta si no confirmó
        if (faltaPregunta && mensajePregunta) {
            try {
                const row = ActionRowBuilder.from(mensajePregunta.components[0]);
                row.components.forEach(c => c.setDisabled(true));
                await mensajePregunta.edit({ components: [row] });
            } catch (e) {}
        }

        // Deshabilitar botones de Gustos si no confirmó
        if (faltaGustos && mensajeGustos) {
            try {
                const row = ActionRowBuilder.from(mensajeGustos.components[0]);
                row.components.forEach(c => c.setDisabled(true));
                await mensajeGustos.edit({ components: [row] });
            } catch (e) {}
        }

        // Si alguna faltó, enviar la alerta combinada
        if (faltaPregunta || faltaGustos) {
            await enviarAlertaInactividadGP(channel, faltaPregunta, faltaGustos);
        }
    }, TIEMPO_1_HORA);
}

// =================================================================
// 3. ALERTAS DE INACTIVIDAD
// =================================================================

// Alerta genérica antigua (se mantiene para Sufrimiento u otros)
async function enviarAlertaActividadesLibres(channel) {
    const botonReclamar = new ButtonBuilder()
        .setCustomId('reclamar_actividad_libre')
        .setLabel('Reclamar Actividad')
        .setEmoji('🙋‍♂️')
        .setStyle(ButtonStyle.Primary);

    await channel.send({
        content: `# <@&${ROL_STAFF_ID}>\n> Hay una actividad disponible para realizarse. ¡Por favor aprieta el botón debajo para así reclamarla!`,
        components: [new ActionRowBuilder().addComponents(botonReclamar)]
    });
}

// NUEVA Alerta dinámica para Gustos y Preguntas
async function enviarAlertaInactividadGP(channel, incluirPregunta, incluirGustos) {
    const row = new ActionRowBuilder();

    // Solo agrega el botón si esa actividad específica está vacante
    if (incluirGustos) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('reclamar_liberado_gustos')
                .setLabel('Reclamar Gustos Canastosos')
                .setEmoji('🧺')
                .setStyle(ButtonStyle.Primary)
        );
    }
    if (incluirPregunta) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('reclamar_liberado_pregunta')
                .setLabel('Reclamar Pregunta del Día')
                .setEmoji('❓')
                .setStyle(ButtonStyle.Primary)
        );
    }

    if (row.components.length > 0) {
        await channel.send({
            content: `# <@&${ROL_STAFF_ID}>\n> Hay actividades sin reclamar o que los usuarios correspondientes no hayan dado su indicio de actividad. ¡Por favor apreté la actividad que quiera realizar para así reclamarla!`,
            components: [row]
        });
    }
}

// =================================================================
// EVENTOS DEL CLIENTE Y PROGRAMACIONES CRON
// =================================================================
client.once('ready', async () => {
    console.log(`Bot conectado como ${client.user.tag}`);
    try {
        const channelCalendario = await client.channels.fetch(CANAL_CALENDARIO_ID);
        const channelAvisos = await client.channels.fetch(CANAL_AVISOS_ID);

        if (!channelCalendario) return;

        const recent = await channelCalendario.messages.fetch({ limit: 10 });
        mensajeCalendario = recent.find(m => m.author.id === client.user.id && m.embeds.length > 0);

        if (!mensajeCalendario) {
            mensajeCalendario = await channelCalendario.send({ embeds: construirEmbeds(), components: construirComponentes() });
        } else {
            await actualizarMensaje();
        }

        const diasNombreUTC = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

        // REINICIO DEL CALENDARIO
        cron.schedule('30 0 * * 0', async () => {
            diasReclamados = { pregunta: {}, gustos: {}, sufrimiento: {} };
           
            if (channelCalendario) {
                mensajeCalendario = await channelCalendario.send({
                    embeds: construirEmbeds(),
                    components: construirComponentes()
                });
            }

            if (channelAvisos) {
                await channelAvisos.send({
                    content: `# __<@&${ROL_STAFF_ID}>__\n> Saludos equipo del staff, se ha reiniciado correctamente el calendario de actividades. Esto indica que ya pueden elegir su día en <#${CANAL_CALENDARIO_ID}>. ¡Nos vemos!`
                });
            }
        }, { timezone: "Etc/UTC" });

        // Recordatorio de Gustos y Preguntas
        cron.schedule('0 16 * * *', async () => {
            const diaHoy = diasNombreUTC[new Date().getUTCDay()];
            if (channelAvisos) {
                await enviarRecordatoriosGP(channelAvisos, diaHoy);
            }
        }, { timezone: "Etc/UTC" });

        // Recordatorio de Sufrimiento
        cron.schedule('55 23 * * *', async () => {
            const diaHoy = diasNombreUTC[new Date().getUTCDay()];
            if (diasReclamados.sufrimiento[diaHoy] && channelAvisos) {
                await enviarRecordatorioSufrimiento(channelAvisos, diaHoy, diasReclamados.sufrimiento[diaHoy]);
            }
        }, { timezone: "Etc/UTC" });

    } catch (e) {
        console.error('Error en evento ready:', e);
    }
});

// =================================================================
// EVENTO: COMANDOS DE TEXTO PARA TESTS MANUALES
// =================================================================
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const diasNombreUTC = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const diaHoy = diasNombreUTC[new Date().getUTCDay()];
    const usuarioPruebaId = message.author.id;

    if (message.content === '.test1') {
        await enviarRecordatorioSufrimiento(message.channel, diaHoy, usuarioPruebaId);
        await message.delete().catch(() => {}); 
    }

    if (message.content === '.test2') {
        try {
            await enviarRecordatoriosGP(message.channel, diaHoy);
            await message.delete().catch(() => {}); 
        } catch (error) {
            console.error(error);
            await message.channel.send('❌ Hubo un error al generar el recordatorio de prueba (Gustos/Preguntas).');
        }
    }

    if (message.content === '.test4') {
        await enviarAlertaActividadesLibres(message.channel);
        await message.delete().catch(() => {}); 
    }

    if (message.content === '.test6') {
        try {
            // Fuerza a que la MISMA persona tenga ambas actividades (Para probar que se envíen los 2 mensajes separados)
            diasReclamados.pregunta[diaHoy] = usuarioPruebaId;
            diasReclamados.gustos[diaHoy] = usuarioPruebaId;
            await enviarRecordatoriosGP(message.channel, diaHoy);
            await message.delete().catch(() => {}); 
        } catch (error) {
            console.error(error);
        }
    }

    if (message.content === '.test7') {
        try {
            // Fuerza a que NADIE tenga las actividades hoy
            diasReclamados.pregunta[diaHoy] = null;
            diasReclamados.gustos[diaHoy] = null;
            await enviarRecordatoriosGP(message.channel, diaHoy);
            await message.delete().catch(() => {}); 
        } catch (error) {
            console.error(error);
        }
    }

    if (message.content === '.test8') {
        try {
            // Envía la alerta de que AMBAS actividades están libres
            await enviarAlertaInactividadGP(message.channel, true, true);
            await message.delete().catch(() => {}); 
        } catch (error) {
            console.error(error);
        }
    }
});

// =================================================================
// EVENTO: LISTENER DE INTERACCIONES (MENÚS Y BOTONES)
// =================================================================
client.on('interactionCreate', async interaction => {
    
    // 1. SELECCIÓN DE DÍA
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('calendario_')) {
        if (mensajeCalendario && interaction.message.id !== mensajeCalendario.id) {
            return interaction.reply({ content: '❌ Este calendario ya ha expirado. Por favor utiliza el mensaje de calendario más reciente.', flags: MessageFlags.Ephemeral });
        }

        const actividad = interaction.customId.split('_')[1]; 
        const dia = interaction.values[0];
        const user = interaction.user.id;

        if (Object.values(diasReclamados[actividad]).includes(user)) {
            return interaction.reply({ content: `❌ Ya tienes un día asignado en esta actividad. Cancela primero.`, flags: MessageFlags.Ephemeral });
        }
        if (diasReclamados[actividad][dia]) {
            return interaction.reply({ content: '❌ Este día ya está ocupado por otra persona en esta actividad.', flags: MessageFlags.Ephemeral });
        }

        diasReclamados[actividad][dia] = user;
        await interaction.update({ embeds: construirEmbeds(), components: construirComponentes() });
    }

    // 2. CANCELAR SELECCIÓN
    if (interaction.isButton() && interaction.customId.startsWith('cancelar_')) {
        if (mensajeCalendario && interaction.message.id !== mensajeCalendario.id) {
            return interaction.reply({ content: '❌ Este calendario ya ha expirado. Por favor utiliza el mensaje de calendario más reciente.', flags: MessageFlags.Ephemeral });
        }

        const actividad = interaction.customId.split('_')[1];
        const user = interaction.user.id;
        const diaOcupado = Object.keys(diasReclamados[actividad]).find(key => diasReclamados[actividad][key] === user);

        if (!diaOcupado) {
            return interaction.reply({ content: `❌ No tienes ningún día reclamado en la categoría ${actividad} para cancelar.`, flags: MessageFlags.Ephemeral });
        }

        delete diasReclamados[actividad][diaOcupado];
        await interaction.update({ embeds: construirEmbeds(), components: construirComponentes() });
        await interaction.followUp({ content: `✅ Has liberado tu día de ${actividad} correctamente.`, flags: MessageFlags.Ephemeral });
    }

    // 3. INDICIO DE ACTIVIDAD
    if (interaction.isButton() && interaction.customId.startsWith('indicio_')) {
        
        if (interaction.customId === 'indicio_actividad_sufrimiento') {
            actividadSufrimientoConfirmada = true;
            if (temporizadorSufrimiento) clearTimeout(temporizadorSufrimiento);
        } else if (interaction.customId === 'indicio_gp_pregunta') {
            actividadPreguntaConfirmada = true;
        } else if (interaction.customId === 'indicio_gp_gustos') {
            actividadGustosConfirmada = true;
        }

        // Si ambas están confirmadas, cancelamos el temporizador general
        if (actividadPreguntaConfirmada && actividadGustosConfirmada && temporizadorGustosPregunta) {
            clearTimeout(temporizadorGustosPregunta);
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

    // 4. RECLAMAR ACTIVIDAD LIBRE (Sufrimiento)
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

    // 5. RECLAMAR ACTIVIDADES LIBERADAS (Gustos y Preguntas)
    if (interaction.isButton() && interaction.customId.startsWith('reclamar_liberado_')) {
        const actividadReclamada = interaction.customId === 'reclamar_liberado_gustos' ? 'Gustos Canastosos' : 'Pregunta del Día';
        await interaction.reply({ content: `✅ <@${interaction.user.id}> ha reclamado la actividad de **${actividadReclamada}**.` });
        
        try {
            const row = ActionRowBuilder.from(interaction.message.components[0]);
            
            // Reemplaza solo el botón que fue presionado
            const nuevosBotones = row.components.map(btn => {
                if (btn.data.custom_id === interaction.customId) {
                    return ButtonBuilder.from(btn)
                        .setLabel(`Reclamado por ${interaction.user.username}`)
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true);
                }
                return ButtonBuilder.from(btn);
            });

            await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(nuevosBotones)] });
        } catch (e) { console.error(e); }
    }

    // 6. TRANSFERIR ACTIVIDAD
    if (interaction.isButton() && interaction.customId.startsWith('transferir_')) {
       
        let esPregunta = interaction.customId === 'transferir_gp_pregunta';
        let esGustos = interaction.customId === 'transferir_gp_gustos';
        let esSufrimiento = interaction.customId === 'transferir_sufrimiento';

        if (esSufrimiento) {
            actividadSufrimientoConfirmada = true; 
            if (temporizadorSufrimiento) clearTimeout(temporizadorSufrimiento);
            await enviarAlertaActividadesLibres(interaction.channel);
        } else if (esPregunta) {
            actividadPreguntaConfirmada = true;
            await enviarAlertaInactividadGP(interaction.channel, true, false);
        } else if (esGustos) {
            actividadGustosConfirmada = true;
            await enviarAlertaInactividadGP(interaction.channel, false, true);
        }

        // Si transfieren una, chequeamos si la otra ya estaba resuelta para limpiar memoria
        if (actividadPreguntaConfirmada && actividadGustosConfirmada && temporizadorGustosPregunta) {
            clearTimeout(temporizadorGustosPregunta);
        }

        await interaction.reply({ content: '🔄 Has transferido la actividad. Se notificará al staff inmediatamente para que alguien la tome.', flags: MessageFlags.Ephemeral });
       
        try {
            const botonDeshabilitado = new ButtonBuilder()
                .setCustomId('actividad_transferida')
                .setLabel('Actividad Transferida')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(botonDeshabilitado)] });
        } catch (e) {}
    }
});

client.login(process.env.DISCORD_TOKEN);
