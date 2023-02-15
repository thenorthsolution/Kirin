import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ColorResolvable, EmbedBuilder, MessageActionRowComponentBuilder, MessageEditOptions } from 'discord.js';
import { Server } from './Server.mjs';

export class MessageContent {

    constructor(readonly server: Server) {}

    public getEmbed(): EmbedBuilder {
        const embed = this.getUnloadedEmbed();

        embed.setColor(this.server.kirin.getMessage<ColorResolvable>(this.server.lastPingData?.status === 'ONLINE' ? 'onlineEmbedColor' : 'offlineEmbedColor'));
        embed.setTimestamp(this.server.lastPingData?.pingedAt);

        if (this.server.description) embed.setDescription(this.server.description);
        if (!this.server.options.showStatusDetails || this.server.lastPingData?.status !== 'ONLINE') return embed;

        embed.addFields(
            {
                name: 'Status',
                value: '**Online**',
                inline: true
            },
            {
                name: 'Online Players',
                value: `${this.server.lastPingData.players.online}/${this.server.lastPingData.players.max}`,
                inline: true
            },
            {
                name: 'Version',
                value: this.server.lastPingData.version || '*Unknown*',
                inline: true
            }
        );

        return embed;
    }

    public getUnloadedEmbed(): EmbedBuilder {
        const embed = new EmbedBuilder();

        embed.setColor('DarkButNotBlack');
        embed.setTitle(this.server.name);
        embed.setFooter({ text: this.server.ip });

        return embed;
    }

    public buttons(): ActionRowBuilder<MessageActionRowComponentBuilder> {
        let buttons = [
            new ButtonBuilder()
                .setStyle(ButtonStyle.Success)
                .setCustomId(`kirin-start-${this.server.id}`)
                .setLabel('Start')
                .setDisabled(this.server.lastPingData?.status == 'ONLINE'),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Danger)
                .setCustomId(`kirin-stop-${this.server.id}`)
                .setLabel('Stop')
                .setDisabled(this.server.lastPingData?.status == 'OFFLINE')
        ];

        if (this.server.options.hideDisabledButtons) buttons = buttons.filter(b => !b.data.disabled);

        return new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(buttons);
    }

    public parse(): MessageEditOptions {
        return {
            content: null,
            embeds: [this.getEmbed()],
            components: [this.buttons()]
        };
    }
}
