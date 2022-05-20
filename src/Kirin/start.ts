import discord from 'discord.js';
import { KirinServer } from './Server';
import { trimChars } from 'fallout-utility';

export default async (server: KirinServer, interaction: discord.ButtonInteraction|discord.SelectMenuInteraction|discord.CommandInteraction) => {
    const kirin = server.kirin;

    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    if (kirin.config.onlineServersLimit > 0 && kirin.servers.filter(s => s.status === 'ONLINE' || !!s.process).length >= kirin.config.onlineServersLimit) {
        interaction.editReply({
            embeds: [
                new discord.MessageEmbed()
                    .setDescription(kirin.getMessage('onlineServersLimitReached', kirin.config.onlineServersLimit))
                    .setColor('RED')
            ]
        }).catch(err => server.logger.error(err));
        return;
    }

    let _err: string|undefined;
    const start = await server.start().catch((err: Error) => {
        if (!err.message.startsWith('ERROR: ')) return server.logger.error(err);
        _err = err.message;
    }) ?? undefined;

    if (!start) {
        interaction.editReply({
            embeds: [
                new discord.MessageEmbed()
                    .setDescription(
                        _err ? trimChars(_err, 'ERROR: ') : 
                        kirin.getMessage('startFailed', server.config.displayName)
                    )
                    .setColor('RED')
            ]
        }).catch(err => server.logger.error(err));
        return;
    }

    interaction.editReply({
        embeds: [
            new discord.MessageEmbed()
                .setDescription(kirin.getMessage('starting', server.config.displayName))
                .setColor('GREEN')
        ]
    });
}