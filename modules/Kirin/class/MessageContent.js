const Server = require('./Server');
const Discord = require('discord.js');

module.exports = class MessageContent {
    /**
     * 
     * @param {Server} server 
     */
    constructor(server) {
        this.server = server;
        this.ping = null;
        this.content = {
            content: ' ',
            embeds: [],
            components: []
        };
    }

    async addContents() {
        const embed = new Discord.MessageEmbed().setColor(this.server.kirin.Client.AxisUtility.config.embedColor).setFooter({ text: 'Last updated' }).setTimestamp();

        if (this.server.name) embed.setTitle(this.server.name);
        if (this.server.description) embed.setDescription(this.server.description);
        if (this.server.icon) embed.setThumbnail(this.server.icon);

        const ping = await this.server.ping();
        if (this.server.kirin.config.pingServers.displayServerStatus) {
            embed.addField(this.server.kirin.config.messages.fieldTitles.status, ping.status === 'ONLINE' ? this.server.kirin.config.messages.status.online : this.server.kirin.config.messages.status.offline,  ping.status === 'ONLINE' ? true : false);

            if (ping.status === 'ONLINE') {
                embed.addField(this.server.kirin.config.messages.fieldTitles.players, `${ping.players.online}/${ping.players.max}`, true);
                embed.addField(this.server.kirin.config.messages.fieldTitles.version, `${ping.version.name}`, true);
            }
        }

        this.content.embeds = [embed];
        this.addComponents(ping.status);

        this.ping = ping;
        return this;
    }

    addComponents(ping = { status: 'OFFLINE' }) {
        this.content.components = [
            new Discord.MessageActionRow().addComponents(this.getButton(ping))
        ];
    }

    getButton(ping) {
        const startButton = new Discord.MessageButton()
            .setCustomId(this.server.interactionId + '_start')
            .setLabel(this.server.kirin.config.messages.buttons.start)
            .setStyle('SUCCESS')
            .setDisabled(ping === 'ONLINE');

        const stopButton = new Discord.MessageButton()
            .setCustomId(this.server.interactionId + '_stop')
            .setLabel(this.server.kirin.config.messages.buttons.stop)
            .setStyle('DANGER')
            .setDisabled(ping === 'OFFLINE');

        const buttons = [startButton];
        if (this.server.kirin.config.addStopButton) buttons.push(stopButton);

        return buttons;
    }
}