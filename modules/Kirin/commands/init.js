const { MessageCommandBuilder } = require('../../../scripts/builders');
const { MessageEmbed } = require('discord.js');
const { SafeMessage } = require('../../../scripts/safeActions');
const Kirin = require('../');

/**
 * 
 * @param {Kirin} kirin 
 * @returns {Object}
 */
module.exports = (kirin) => {
    return {
        command: new MessageCommandBuilder()
        .setName('kirin-init')
        .setDescription('Creates message with information about guildId, channelId, messageId')
        .setExecute(async (args, message) => {
            const guildId = message.guild.id;
            const channelId = message.channel.id;
            
            const embed = new MessageEmbed()
                .setTitle('Kirin init')
                .setDescription('This message contains information about guildId, channelId, messageId')
                .addField('guildId', guildId)
                .addField('channelId', channelId)
                .addField('messageId', `Please wait...`)

            const reply = await SafeMessage.send(message.channel, { content: ' ', embeds: [ embed ] });
            
            const messageId = reply.id;
            embed.fields[2].value = messageId;

            await SafeMessage.edit(reply, { content: ' ', embeds: [ embed ] });
            await SafeMessage.delete(message);
        })
    };
}