import discord from 'discord.js';
import { KirinServer } from './Server';
import stop from './stop';
import start from './start';

export default async (server: KirinServer, interaction: discord.ButtonInteraction|discord.SelectMenuInteraction|discord.CommandInteraction) => {
    const kirin = server.kirin;

    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    server.once('stop', async () => {
        await start(server, interaction);

        interaction.editReply({
            embeds: [
                new discord.MessageEmbed()
                    .setDescription(kirin.getMessage('restarting', server.config.displayName))
                    .setColor('GREEN')
            ]
        }).catch(err => server.logger.error(err));
    });
    await stop(server, interaction);
}