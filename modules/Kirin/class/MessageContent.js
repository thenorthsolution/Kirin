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

    addContents() {
        this.content.embeds = [
            new Discord.MessageEmbed()
                .setColor(this.server.config.embedColor)
        ]
    }
}