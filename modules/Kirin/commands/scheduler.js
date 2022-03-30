const ms = require('ms');
const Kirin = require('../');
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
                    .setName('schedule')
                    .setDescription('Schedule server actions')
                    .addStringOption(server => server
                        .setName('server')
                        .setDescription('The name of the server')
                        .setRequired(true)
                    )
                    .addStringOption(action => action
                        .setName('action')
                        .setDescription('The action to schedule')
                        .addChoice('start', 'start')
                        .addChoice('stop', 'stop')
                        .setRequired(true)
                    )
                    .addStringOption(time => time
                        .setName('time')
                        .setDescription('The time to schedule the action')
                        .setRequired(true)    
                    )
                    .addChannelOption(channel => channel
                        .setName('callback-channel')
                        .setDescription('The channel to send the callback message to')
                        .addChannelTypes([0])
                        .setRequired(false)    
                    )
                )
                .setExecute(async (interaction) => {
                    const server = kirin.servers.find(_server => (_server.interactionId === interaction.options.getString('server') || _server.name.toLowerCase() === interaction.options.getString('server')) && _server.isActive);
                    const action = interaction.options.getString('action');
                    const time = ms(interaction.options.getString('time'));
                    const callbackChannel = interaction.options.getChannel('callback-channel');

                    if (!server || !interaction.member || !ms) return;
                    kirin.logger.warn('Scheduling action: ' + action + ' on server: ' + server.name + ' for ' + ms(time, { long: true }) + ' by ' + interaction.user.tag, 'Kirin');
                    switch (action) {
                        case 'start':
                            if (!kirin.checkPermissions(interaction.member, kirin.config.start.allowedPermissions, kirin.config.start.allowedRoles)) return SafeInteract.reply(interaction, kirin.config.messages.process.noPermissions);
                            if (server.scriptProcess) return SafeInteract.reply(interaction, kirin.config.messages.process.alreadyRunning);
                            if (kirin.config.onlineServersLimit != 0 && kirin.onlineServers().length >= kirin.config.onlineServersLimit) return SafeInteract.reply(interaction, kirin.config.messages.errors.onlineServersLimitMessage);
                            return server.scheduleStart(interaction, time, callbackChannel);
                        case 'stop':
                            if (!kirin.checkPermissions(interaction.member, kirin.config.stop.allowedPermissions, kirin.config.stop.allowedRoles)) return SafeInteract.reply(interaction, kirin.config.messages.process.noPermissions);
                            return server.scheduleStop(interaction, time, callbackChannel);
                    }
                })
        ]
    }
}