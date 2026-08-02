require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Borrando todos los comandos de barra...');

        // Al enviar un array vacío [], Discord elimina cualquier comando registrado
        await rest.put(
            Routes.applicationCommands('1499992673950371860'), // Reemplaza con el ID de tu aplicación (Client ID)
            { body: [] },
        );

        console.log('¡Listo! Todos los comandos han sido eliminados de Discord.');
    } catch (error) {
        console.error('Hubo un error al borrar los comandos:', error);
    }
})();
