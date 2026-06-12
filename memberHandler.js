// memberHandler.js
const { Events } = require('discord.js');

const USUARIO_ESPECIAL_ID = '1514851403213050118'; 
const ROL_A_ASIGNAR_ID = '1481404982723874847';
const LOG_CHANNEL_ID = '1380321494298792147';

module.exports = (client) => {
    client.on(Events.GuildMemberAdd, async (member) => {
        if (member.id === USUARIO_ESPECIAL_ID) {
            try {
                const role = member.guild.roles.cache.get(ROL_A_ASIGNAR_ID);
                if (role) {
                    await member.roles.add(role);
                    
                    // --- Aquí enviamos solo el mensaje de texto ---
                    const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
                    if (logChannel) {
                        await logChannel.send(
                            `Se le ha añadido el rol **${role.name}** a <@${member.id}> por sospechas de suplantación de identidad.`
                        );
                    }
                    console.log(`Rol asignado y mensaje de log enviado para ${member.user.tag}`);
                }
            } catch (err) {
                console.error("Error al asignar rol:", err);
            }
        }
    });
};
