import { ColorResolvable, MessageActionRow, MessageButton, MessageEditOptions, MessageEmbed } from 'discord.js';
import { Server } from './Server';

export class MessageContent {
    public server: Server;
    public data: MessageEditOptions = {
        content: '',
        embeds: [],
        components: []
    };

    constructor (server: Server) {
        this.server = server;
    }

    public getData(): MessageEditOptions {
        return {
            ...this.data,
            content: '',
            embeds: [this.makeEmbed()],
            components: this.server.kirin.config.miscellaneous.disableAllButtons ? [] : [this.makeButtons()]
        };
    }

    public makeEmbed(): MessageEmbed {
        const embed = new MessageEmbed();

        embed.setColor(this.server.kirin.getMessage<ColorResolvable>('onlineEmbedColor', this.server.status == 'ONLINE' ? 'BLUE' : 'DARK_BUT_NOT_BLACK'));
        embed.setTitle(this.server.options.name ?? this.server.id);
        embed.setFooter({ text: this.server.id });
        embed.setTimestamp();

        if (this.server.options.description) embed.setDescription(this.server.options.description);
        if (this.server.kirin.config.ping.displayServerStatus) {
            if (this.server.status == 'ONLINE') {
                embed.addFields([
                    {
                        name: this.server.kirin.getMessage('embedStatusLabel', 'Status'),
                        value: this.server.kirin.getMessage('embedStatusOnline', '**Online**'),
                        inline: true
                    },
                    {
                        name: this.server.kirin.getMessage('embedPlayersLabel', 'Online Players'),
                        value: this.server.kirin.getMessage('embedPlayersList', '{0}/{1}', `${this.server.lastPingData?.players.online ?? 0}`, `${this.server.lastPingData?.players.max ?? 0}`),
                        inline: true
                    },
                    {
                        name: this.server.kirin.getMessage('embedVersionLabel', 'Server Version'),
                        value: this.server.kirin.getMessage('embedVersionValue', '{0}', this.server.lastPingData?.version ?? 'Unknown'),
                        inline: true
                    }
                ]);
            } else {
                embed.addFields([
                    {
                        name: this.server.kirin.getMessage('embedStatusLabel', 'Status'),
                        value: this.server.kirin.getMessage('embedStatusOffline', '**Offline**'),
                        inline: true
                    }
                ]);
            }
        }

        return embed;
    }

    public makeButtons(): MessageActionRow {
        let buttons = [
            new MessageButton()
                .setStyle("SUCCESS")
                .setCustomId(`${this.server.id}-start`)
                .setLabel(this.server.kirin.getMessage('startButtonLabel', 'Start'))
                .setDisabled(this.server.status == 'ONLINE'),
            new MessageButton()
                .setStyle("SECONDARY")
                .setCustomId(`${this.server.id}-stop`)
                .setLabel(this.server.kirin.getMessage('stopButtonLabel', 'Stop'))
                .setDisabled(this.server.status == 'OFFLINE')
        ];

        if (this.server.kirin.config.miscellaneous.deleteDisabledButtons) buttons = buttons.filter(b => !b.disabled);
        return new MessageActionRow().addComponents(...buttons);
    }
}
