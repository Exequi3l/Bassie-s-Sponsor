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
const CANAL_CALENDARIO_ID = '1533254417065840702'; // NUEVO CANAL DE PRUEBAS
const CANAL_AVISOS_ID = '1380321494298792147';     
const CANAL_SUFRIMIENTO_ID = '1372697602985955388';
const CANAL_ACTIVIDAD_GUSTOS_ID = '1444430795329503263';
const CANAL_ENCUESTA_GUSTOS_ID = '1514030783902519316';

// ID de rol de Staff para notificaciones y alertas
const ROL_STAFF_ID = '1531150257210003456';

// Control de días y temporizadores
let diasReclamados = {};
let mensajeCalendario = null; 

let actividadSufrimientoConfirmada = false;
let temporizadorSufrimiento = null;

let actividadGustosConfirmada = false;
let temporizadorGustos = null;

const diasSemana = [
    { label: 'Lunes', value: 'lunes' },
    { label: 'Martes', value: 'martes' },
    { label: 'Miércoles', value: 'miercoles' },
    { label: 'Jueves', value: 'jueves' },
    { label: 'Viernes', value: 'viernes' },
    { label: 'Sábado', value: 'sabado' },
    { label: 'Domingo', value: 'domingo' }
];

// Generar los 5 Embeds
function construirEmbeds() {
    // Generamos la lista del calendario una sola vez para copiarla en los demás embeds
    let listaCalendario = '';
    for (const dia of diasSemana) {
        const usuarioId = diasReclamados[dia.value];
        listaCalendario += `⤷ ${dia.label} ﹕ ${usuarioId ? `<@${usuarioId}>` : '🟢 Disponible'}\n`;
    }

    // 1. Embed Principal (Información y único con descripción larga)
    const descripcionInfo = '**E**n el apartado de abajo selecciona un día para reclamarlo, esto es una organización para las actividades semanales. \n**S**i un día ya está ocupado aparecerá asignado a su respectivo usuario.\n\n' + listaCalendario;

    const embedInfo = new EmbedBuilder()
        .setTitle('ৎㅤ︵ㅤCalendario semanal de actividadesㅤ.ᐟ')
        .setDescription(descripcionInfo)
        .setColor('#3498DB');

    // 2. Embed Pregunta del Día (Copia el calendario)
    const embedPregunta = new EmbedBuilder()
        .setTitle('❓ Pregunta del Día')
        .setDescription(listaCalendario)
        .setColor('#5865F2');

    // 3. Embed Gustos Canastosos (Copia el calendario)
    const embedGustos = new EmbedBuilder()
        .setTitle('🧺 Gustos Canastosos')
        .setDescription(listaCalendario)
        .setColor('#F1C40F'); 

    // 4. Embed Sufrimiento del Día (Copia el calendario)
    const embedSufrimiento = new EmbedBuilder()
        .setTitle('📭 Sufrimiento del Día')
        .setDescription(listaCalendario)
        .setColor('#E74C3C'); 

    // 5. Embed Cancelar
    const embedCancelar = new EmbedBuilder()
        .setDescription('**¿Deseas cancelar tu actividad?**\nSi ya habías reclamado un día y quieres liberarlo, presiona el botón de abajo.')
        .setColor('#2F3136'); 

    return [embedInfo, embedPregunta, embedGustos, embedSufrimiento, embedCancelar];
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
        }).catch(console.error);
    }
}

// =================================================================
// 1. RECORDATORIO: SUFRIMIENTO DEL DÍA (15 Minutos de espera)
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
// 2. RECORDATORIO: PREGUNTA Y GUSTOS DÍA (1 Hora de espera)
// =================================================================
async function enviarRecordatorioGustos(channel, diaValor, usuarioId) {
    const diaObjeto = diasSemana.find(d => d.value === diaValor);
    const nombreDia = diaObjeto ? diaObjeto.label : 'Hoy';

    actividadGustosConfirmada = false;

    const botonIndicio = new ButtonBuilder()
        .setCustomId('indicio_actividad_gustos')
        .setLabel('Dar Indicio de Actividad')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success);

    const botonTransferir = new ButtonBuilder()
        .setCustomId('transferir_gustos')
        .setLabel('Transferir Actividad')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(botonIndicio, botonTransferir);

    const mensajeRecordatorio = await channel.send({
        content: `# Pregunta y gustos día **${nombreDia}** <:pregunta:1508531730225696798>\nSaludos, momento de un pequeño recordatorio: \n> Buenos días <@${usuarioId}> Recuerda que esta es la hora en la que tienes que hacer la <#${CANAL_ACTIVIDAD_GUSTOS_ID}> el día de hoy.\nAdemás, te toca hacer la encuesta de <#${CANAL_ENCUESTA_GUSTOS_ID}>.\nSi no puedes hacerlo, aprieta el botón de transferir, de lo contrario se alertará al staff en una hora.`,
        components: [row]
    });

    if (temporizadorGustos) clearTimeout(temporizadorGustos);

    const TIEMPO_1_HORA = 60 * 60 * 1000;

    temporizadorGustos = setTimeout(async () => {
        if (!actividadGustosConfirmada) {
            try {
                botonIndicio.setDisabled(true);
                botonTransferir.setDisabled(true);
                await mensajeRecordatorio.edit({ components: [new ActionRowBuilder().addComponents(botonIndicio, botonTransferir)] });
            } catch (err) {}

            await enviarAlertaActividadesLibres(channel);
        }
    }, TIEMPO_1_HORA);
}

// =================================================================
// 3. ALERTA: ACTIVIDADES LIBRES (Ping a todo el Staff)
// =================================================================
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

        // REINICIO DEL CALENDARIO: Domingos a las 00:30 UTC (12:30 AM GMT / 9:30 PM GMT-3 del Sábado)
        cron.schedule('30 0 * * 0', async () => {
            diasReclamados = {}; 
            
            // Envía un mensaje totalmente NUEVO al canal
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

        cron.schedule('0 16 * * *', async () => {
            const diaHoy = diasNombreUTC[new Date().getUTCDay()];

            if (diasReclamados[diaHoy] && channelAvisos) {
                await enviarRecordatorioGustos(channelAvisos, diaHoy, diasReclamados[diaHoy]);
            }
        }, { timezone: "Etc/UTC" });

        cron.schedule('55 23 * * *', async () => {
            const diaHoy = diasNombreUTC[new Date().getUTCDay()];

            if (diasReclamados[diaHoy] && channelAvisos) {
                await enviarRecordatorioSufrimiento(channelAvisos, diaHoy, diasReclamados[diaHoy]);
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

    if (message.content === '.test') {
        try {
            diasReclamados = {};
            const canalCalendario = await client.channels.fetch(CANAL_CALENDARIO_ID);
            if (canalCalendario) {
                mensajeCalendario = await canalCalendario.send({ 
                    embeds: construirEmbeds(), 
                    components: construirComponentes() 
                });
                await message.reply(`✅ Nuevo calendario enviado exitosamente a <#${CANAL_CALENDARIO_ID}>.`);
            }
        } catch (error) {
            console.error(error);
            await message.reply('❌ Hubo un error al intentar enviar el nuevo calendario.');
        }
    }

    if (message.content === '.test1') {
        try {
            await enviarRecordatorioSufrimiento(message.channel, diaHoy, usuarioPruebaId);
            await message.delete().catch(() => {}); 
        } catch (error) {
            console.error(error);
            await message.channel.send('❌ Hubo un error al generar el recordatorio de prueba (Sufrimiento del Día).');
        }
    }

    if (message.content === '.test2') {
        try {
            await enviarRecordatorioGustos(message.channel, diaHoy, usuarioPruebaId);
            await message.delete().catch(() => {}); 
        } catch (error) {
            console.error(error);
            await message.channel.send('❌ Hubo un error al generar el recordatorio de prueba (Gustos Canastosos).');
        }
    }

    if (message.content === '.test3') {
        try {
            await enviarRecordatorioGustos(message.channel, diaHoy, usuarioPruebaId);
            await message.delete().catch(() => {}); 
        } catch (error) {
            console.error(error);
            await message.channel.send('❌ Hubo un error al generar el recordatorio de prueba (Pregunta del Día).');
        }
    }

    if (message.content === '.test4') {
        try {
            await enviarAlertaActividadesLibres(message.channel);
            await message.delete().catch(() => {}); 
        } catch (error) {
            console.error(error);
            await message.channel.send('❌ Hubo un error al generar la alerta del staff.');
        }
    }

    if (message.content === '.test5') {
        try {
            diasReclamados = {};
            const canalCalendario = await client.channels.fetch(CANAL_CALENDARIO_ID);
            const canalAvisos = await client.channels.fetch(CANAL_AVISOS_ID);

            if (canalCalendario) {
                mensajeCalendario = await canalCalendario.send({ 
                    embeds: construirEmbeds(), 
                    components: construirComponentes() 
                });
            }

            if (canalAvisos) {
                await canalAvisos.send({
                    content: `# __<@&${ROL_STAFF_ID}>__\n> Saludos equipo del staff, se ha reiniciado correctamente el calendario de actividades. Esto indica que ya pueden elegir su día en <#${CANAL_CALENDARIO_ID}>. ¡Nos vemos!`
                });
            }

            await message.reply('✅ Reinicio completo del calendario ejecutado.');
        } catch (error) {
            console.error(error);
            await message.reply('❌ Hubo un error al ejecutar el reinicio de prueba.');
        }
    }
});

// =================================================================
// EVENTO: LISTENER DE INTERACCIONES (MENÚS Y BOTONES)
// =================================================================
client.on('interactionCreate', async interaction => {
    
    // 1. SELECCIÓN DE DÍA
    if (interaction.isStringSelectMenu() && interaction.customId === 'calendario_menu') {
        if (mensajeCalendario && interaction.message.id !== mensajeCalendario.id) {
            return interaction.reply({ content: '❌ Este calendario ya ha expirado. Por favor utiliza el mensaje de calendario más reciente.', flags: MessageFlags.Ephemeral });
        }

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
        if (mensajeCalendario && interaction.message.id !== mensajeCalendario.id) {
            return interaction.reply({ content: '❌ Este calendario ya ha expirado. Por favor utiliza el mensaje de calendario más reciente.', flags: MessageFlags.Ephemeral });
        }

        const user = interaction.user.id;
        const diaOcupado = Object.keys(diasReclamados).find(key => diasReclamados[key] === user);

        if (!diaOcupado) {
            return interaction.reply({ content: '❌ No tienes ningún día reclamado para cancelar.', flags: MessageFlags.Ephemeral });
        }

        delete diasReclamados[diaOcupado];
        await interaction.update({ embeds: construirEmbeds(), components: construirComponentes() });
        await interaction.followUp({ content: '✅ Has liberado tu día correctamente.', flags: MessageFlags.Ephemeral });
    }

    // 3. INDICIO DE ACTIVIDAD
    if (interaction.isButton() && (interaction.customId === 'indicio_actividad_sufrimiento' || interaction.customId === 'indicio_actividad_gustos')) {
        if (interaction.customId === 'indicio_actividad_sufrimiento') {
            actividadSufrimientoConfirmada = true;
            if (temporizadorSufrimiento) clearTimeout(temporizadorSufrimiento);
        } else {
            actividadGustosConfirmada = true;
            if (temporizadorGustos) clearTimeout(temporizadorGustos);
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

    // 4. RECLAMAR ACTIVIDAD LIBRE
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

    // 5. TRANSFERIR ACTIVIDAD
    if (interaction.isButton() && (interaction.customId === 'transferir_sufrimiento' || interaction.customId === 'transferir_gustos')) {
        
        if (interaction.customId === 'transferir_sufrimiento') {
            actividadSufrimientoConfirmada = true; 
            if (temporizadorSufrimiento) clearTimeout(temporizadorSufrimiento);
        } else {
            actividadGustosConfirmada = true;
            if (temporizadorGustos) clearTimeout(temporizadorGustos);
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

        await enviarAlertaActividadesLibres(interaction.channel);
    }
});

client.login(process.env.DISCORD_TOKEN);
