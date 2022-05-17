import { KirinModule } from '../kirin.reciple';
import { KirinServer } from './Server'
import discord from 'discord.js';

export class MessageContent {
    public server: KirinServer;
    public kirin: KirinModule;

    constructor(server: KirinServer) {
        this.server = server;
        this.kirin = server.kirin;

        if (!this.server.channel) throw new Error('Channel is not defined');
        if (!this.server.message) throw new Error('Message is not defined');
        if (!this.server.lastPingData) throw new Error('LastPingData is not defined');
    }

    public getMessage() {
        return {
            content: '',
            attachments: [],
            embeds: [this.getEmbed()],
            components: [this.server.config.useMenu ? this.getMenu() : this.getButtons()]
        };
    }

    public getMenu(): discord.MessageActionRow {
        let menu = new discord.MessageSelectMenu()
            .setMaxValues(1)
            .setPlaceholder(this.kirin.getMessage('menuPlaceholder'))
            .setCustomId(`kirin-server-menu-${this.server.id}`);

        if (this.server.config.start?.addButton && this.server.status == 'ONLINE') {
            menu.addOptions([
                {
                    label: this.kirin.getMessage('menuStartOption'),
                    value: `kirin-server-start-${this.server.id}`
                }
            ]);
        }

        if (this.server.config.stop?.addButton && this.server.status == 'OFFLINE') {
            menu.addOptions([
                {
                    label: this.kirin.getMessage('menuStopOption'),
                    value: `kirin-server-stop-${this.server.id}`
                }
            ]);
        }

        if (this.server.config.start?.addButton && this.server.status == 'OFFLINE') {
            menu.addOptions([
                {
                    label: this.kirin.getMessage('menuStartOption'),
                    value: `kirin-server-start-${this.server.id}`
                }
            ]);
        }

        return new discord.MessageActionRow().addComponents([menu]);
    }

    public getButtons(): discord.MessageActionRow {
        let buttons = [
            new discord.MessageButton()
                .setLabel(this.kirin.getMessage('embedButtonStart'))
                .setCustomId(`kirin-server-start-${this.server.id}`)
                .setStyle('SUCCESS')
                .setDisabled(this.server.status == 'ONLINE'),
            new discord.MessageButton()
                .setLabel(this.kirin.getMessage('embedButtonStop'))
                .setCustomId(`kirin-server-stop-${this.server.id}`)
                .setStyle('DANGER')
                .setDisabled(this.server.status == 'OFFLINE'),
            new discord.MessageButton()
                .setLabel(this.kirin.getMessage('embedButtonRestart'))
                .setCustomId(`kirin-server-restart-${this.server.id}`)
                .setStyle('SECONDARY')
                .setDisabled(this.server.status == 'OFFLINE')
        ];

        if (!this.server.config.start?.addButton) buttons = buttons.filter(b => b.style === 'SUCCESS');
        if (!this.server.config.stop?.addButton) buttons = buttons.filter(b => b.style === 'DANGER');
        if (!this.server.config.restart?.addButton) buttons = buttons.filter(b => b.style === 'SECONDARY');
        if (this.kirin.config.deleteDisabledButtons) buttons = buttons.filter(btn => !btn.disabled);

        return new discord.MessageActionRow().addComponents(buttons);
    }

    public getEmbed(): discord.MessageEmbed {
        return new discord.MessageEmbed()
            .setColor(
                this.kirin.getMessage(
                    this.server.status === 'ONLINE' ? 'onlineEmbedColor' : 'offlineEmbedColor'
                ) as discord.ColorResolvable
            )
            .setAuthor({
                name: `${this.server.config.host}:${this.server.config.port}`
            })
            .setTitle(this.server.config.displayName)
            .setDescription(this.server.config.description)
            .addFields([
                {
                    name: `Status`,
                    value: this.kirin.getMessage(
                        this.server.status === 'ONLINE' ? 'onlineEmbedStatus' : 'offlineEmbedStatus'
                    ),
                    inline: true
                },
                {
                    name: `Players`,
                    value: this.kirin.getMessage('embedPlayerCount', this.server.lastPingData?.players.online ?? 0, this.server.lastPingData?.players.max ?? 0),
                    inline: true
                },
                {
                    name: `Version`,
                    value: this.server.lastPingData?.version ?? 'Unknown',
                    inline: true
                }
            ]);
    }
}