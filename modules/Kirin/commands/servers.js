const Kirin = require('..');
const { InteractionCommandBuilder } = require('../../../scripts/builders');
const { SafeInteract } = require('../../../scripts/safeActions');
const { MessageEmbed } = require('discord.js');

/**
 * 
 * @param {Kirin} kirin 
 */
module.exports = (kirin) => {
    return {
        commands: [
            new InteractionCommandBuilder()
                .setCommand(SlashCommandBuilder => SlashCommandBuilder
                    .setName('server-list')
                    .setDescription('Lists all servers')
                )
                .setExecute(async (interaction) => {
                    const servers = kirin.servers;
                    const embed = new MessageEmbed()
                        .setColor(kirin.Client.AxisUtility.config.embedColor)
                        .setTitle('Servers')
                        .setDescription(servers.map(_server => `**${_server.name}** — ${_server.ping.status === 'ONLINE' ? kirin.config.messages.status.onlineIndicator : kirin.config.messages.status.offlineIndicator }`).join('\n'))
                        .setFooter({ text: `${servers.length} servers` })
                        .setTimestamp();

                    return SafeInteract.reply(interaction, { content: ' ', embeds: [embed] });
                })
        ]
    }
}