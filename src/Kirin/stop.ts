import discord from 'discord.js';
import { KirinServer } from './Server';
import { trimChars } from 'fallout-utility';

export default async (server: KirinServer, interaction: discord.ButtonInteraction|discord.SelectMenuInteraction) => {
    const kirin = server.kirin;

    if (!interaction.deferred) await interaction.deferReply({ ephemeral: true });

    let _err: string|undefined;
    const stop = await server.stop().catch((err: Error) => {
        _err = err.message;
        server.logger.error(err);
    });

    if (!stop) {
        interaction.editReply({
            embeds: [
                new discord.MessageEmbed()
                    .setDescription(
                        typeof _err == 'string' && _err.startsWith('ERROR: ') ? 
                        trimChars(_err, 'ERROR: ') : 
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