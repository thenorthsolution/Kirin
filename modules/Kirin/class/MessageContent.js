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
            embeds: []
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
        const buttons = this.getButton(ping);
        
        this.content.components = buttons.length ? [
            new Discord.MessageActionRow().addComponents(buttons)
        ] : [];

        return this;
    }

    getButton(ping) {
        const startButton = new Discord.MessageButton()
            .setCustomId(this.server.interactionId + '_start')
            .setLabel(this.server.kirin.config.messages.buttons.start)
            .setStyle('SUCCESS')
            .setDisabled(ping === 'ONLINE' || !!this.server.scriptProcess);

        const stopButton = new Discord.MessageButton()
            .setCustomId(this.server.interactionId + '_stop')
            .setLabel(this.server.kirin.config.messages.buttons.stop)
            .setStyle('DANGER')
            .setDisabled(ping === 'OFFLINE' || !!!this.server.scriptProcess);

        const restartButton = new Discord.MessageButton()
            .setCustomId(this.server.interactionId + '_restart')
            .setLabel(this.server.kirin.config.messages.buttons.restart)
            .setStyle('SECONDARY')
            .setDisabled(ping === 'OFFLINE' || !!!this.server.scriptProcess);

        const buttons = [];
        if (this.server.kirin.config.start.enabled && this.server.kirin.config.start.addButton) buttons.push(startButton);
        if (this.server.kirin.config.stop.enabled && this.server.kirin.config.stop.addButton) buttons.push(stopButton);
        if (this.server.kirin.config.restart.enabled && this.server.kirin.config.restart.addButton) buttons.push(restartButton);

        return buttons.filter(button => this.server.kirin.config.deleteDisabledButtons && !button.disabled);
    }
}