import discord from 'discord.js';
import { KirinServer } from './Server';
import { trimChars } from 'fallout-utility';

export default async (server: KirinServer, interaction: discord.ButtonInteraction|discord.SelectMenuInteraction|discord.CommandInteraction) => {
    const kirin = server.kirin;

    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

    let _err: string|undefined;
    const stop = await server.stop().catch((err: Error) => {
        if (!err.message.startsWith('ERROR: ')) return server.logger.error(err);
        _err = err.message;
    });

    if (!stop) {
        interaction.editReply({
            embeds: [
                new discord.MessageEmbed()
                    .setDescription(
                        _err ? trimChars(_err, 'ERROR: ') : 
                        kirin.getMessage('stopFailed', server.config.displayName)
                    )
                    .setColor('RED')
            ]
        }).catch(err => server.logger.error(err));
        return;
    }

    interaction.editReply({
        embeds: [
            new discord.MessageEmbed()
                .setDescription(kirin.getMessage('stopping', server.config.displayName))
                .setColor('GREEN')
        ]
    });
}