const Kirin = require('..');
const { InteractionCommandBuilder, MessageCommandBuilder } = require('../../../scripts/builders');
const { SafeInteract } = require('../../../scripts/safeActions');

/**
 * 
 * @param {Kirin} kirin 
 */
module.exports = (kirin) => {
    return {
        commands: [
            new InteractionCommandBuilder()
                .setCommand(SlashCommandBuilder => SlashCommandBuilder
                    .setName('stop-server')
                    .setDescription('Stops a server')
                    .addStringOption(server => server
                        .setName('server')
                        .setDescription('The name of the server')
                        .setRequired(true)
                    )
                )
                .setExecute(async (interaction) => {
                    const server = kirin.servers.find(_server => (_server.interactionId === interaction.options.getString('server') || _server.name.toLowerCase() === interaction.options.getString('server')) && _server.isActive);
                    
                    if (!server || !server.isActive || !interaction.member || !server.interactionFilter(interaction)) return;
                    if (!kirin.checkPermissions(interaction.member, kirin.config.stop.allowedPermissions, kirin.config.stop.allowedRoles)) return SafeInteract.reply(interaction, kirin.config.messages.process.noPermissions);
                    if (!server.scriptProcess) return SafeInteract.reply(interaction, kirin.config.messages.process.notRunning);
                    
                    return server.stop(interaction);
                })
        ]
    }
}