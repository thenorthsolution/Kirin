const Server = require('./Server');
const Discord = require('discord.js');

module.exports = class MessageContent {
    /**
     * 
     * @param {Server} server 
     */
    constructor(server) {
        this.server = server;
        this.content = {
            content: ' ',
            embeds: [],
            components: []
        };
    }

    async addContents() {
        const embed = new Discord.MessageEmbed().setColor(this.server.kirin.Client.AxisUtility.config.embedColor);

        embed.setTitle(this.server.name);
        if (this.server.description) embed.setDescription(this.server.description);
        if (this.server.icon) embed.setThumbnail(this.server.icon);

        const ping = await this.server.ping();
        if (this.server.kirin.config.pingServers.displayServerStatus) {
            embed.addField(this.server.kirin.config.messages.fieldTitles.status, ping.status === 'ONLINE' ? this.server.kirin.config.messages.status.online : this.server.kirin.config.messages.status.offline,  ping.status === 'ONLINE' ? true : false);

            if (ping.status === 'ONLINE') {
                embed.addField(this.server.kirin.config.messages.fieldTitles.players, `${ping.players.online}/${ping.players.max}`, true);
                embed.addField(this.server.kirin.config.messages.fieldTitles.version, ping.version, true);
            }
        }

        this.content.embeds = [embed];
        this.addComponents();

        return this;
    }

    addComponents() {
        this.content.components = [
            new Discord.MessageActionRow().addComponents(this.getButton())
        ];
    }

    getButton(disabled = false) {
        const startButton = new Discord.MessageButton()
            .setCustomId(this.server.interactionId)
            .setLabel(this.server.kirin.config.messages.buttons.start)
            .setStyle('SUCCESS')
            .setDisabled(disabled);

        return [startButton];
    }
}