const { InteractionCommandBuilder, MessageCommandBuilder } = require('../../scripts/builders');
const { SafeInteract } = require('../../scripts/safeActions');
const makeConfig = require('../../scripts/makeConfig');
const sysInfo = require('./class/SystemInfo');
const util = require('fallout-utility');
const yml = require('yaml');
const fs = require('fs');
const Server = require('./class/Server');
const Discord = require('discord.js');

module.exports = class Kirin {
    /**
     * 
     * @param {Discord.Client} Client 
     * @param {import ('minecraft-protocol')} minecraftProtocol
     */
    constructor (Client, minecraftProtocol = require('minecraft-protocol')) {
        this.Client = Client;
        this.logger = Client.AxisUtility.logger;
        this.rootDir = './config/kirin';
        this.minecraftProtocol = minecraftProtocol;
        this.sysInfo = null;
        this.config = this.getConfig();
        this.servers = this.getServers();
        this.commands = this.getCommands();
    }

    /**
     * 
     * @returns {InteractionCommandBuilder[]|MessageCommandBuilder[]}
     */
    getCommands() {
        const commandsFolder = fs.readdirSync(`./${this.Client.AxisUtility.config.modulesFolder}/Kirin/commands/`, 'utf8').filter(file => file.endsWith('.js'));

        const disabledCommands = this.disabledCommands();
        let commands = [];
        
        for (const file of commandsFolder) {
            try {
                commands = [...commands, ...require(`./commands/${file}`)(this).commands];
            } catch (error) {
                this.logger.error(error, 'Kirin/Command');
            }
        }
        
        return commands.filter(cmd => !disabledCommands.includes(cmd.name));
    }

    /**
     * 
     * @returns {Object}
     */
    getConfig() {
        const config = fs.readFileSync(`./${this.Client.AxisUtility.config.modulesFolder}/Kirin/templates/config.yml`, 'utf8');

        return yml.parse(makeConfig(`${this.rootDir}/config.yml`, util.replaceAll(config, '{rootDir}', this.rootDir)));
    }

    /**
     * 
     * @returns {Server[]}
     */
    getServers() {
        if (!this.config?.serverListFile) throw new Error('No serverLists found in config.yml');

        const serversHeader = fs.readFileSync(`./${this.Client.AxisUtility.config.modulesFolder}/Kirin/templates/serverlist.yml`, 'utf8');
        const servers = yml.parse(makeConfig(this.config.serverListFile, `${serversHeader}\n${yml.stringify({ servers: [] })}`));

        return servers.servers.map(_server => {
            const server = new Server(this, _server.serverId, _server.startScript,  _server.startScriptPath, _server.host, _server.port, _server.message);
            
            server.guildId = _server.guildId;
            server.channelId = _server.channelId;
            server.messageId = _server.messageId;

            return server;
        });
    }

    async parseServers() {
        this.logger.log('Updating servers status...');
        for (const server of this.servers) {
            this.logger.log(`Updating server ${server.name} status...`);
            await server.parse(server.guildId, server.channelId, server.messageId);
            server.refreshMessage();
            this.logger.log(`Server ${server.name} status updated.`);
        }

        this.logger.log('Servers updated.');

        this.sysInfo = await (new sysInfo(this)).getMessage();
        this.sysInfo.getInfo();
    }

    onlineServers() {
        return this.servers.filter(srv => srv.status === 'ONLINE' || !!srv.scriptProcess);
    }

    listenInteractions() {
        this.Client.on('interactionCreate',
            /**
             * 
             * @param {Discord.ButtonInteraction} interaction 
             */
            async interaction => {
                if (!interaction.isButton()) return;
                const serverId = interaction.customId.split('_')[0];
                const serverAction = interaction.customId.split('_')[1];

                const server = this.servers.find(srv => srv.interactionId === serverId);
                if (!server || !server?.isActive || !interaction.member || !server.interactionFilter(interaction)) return;

                switch (serverAction) {
                    case 'start':
                        if (!this.checkPermissions(interaction.member, this.config.start.allowedPermissions, this.config.start.allowedRoles)) return SafeInteract.reply(interaction, this.config.messages.process.noPermissions);
                        if (server.scriptProcess) return SafeInteract.reply(interaction, this.config.messages.process.alreadyRunning);
                        if (this.config.onlineServersLimit != 0 && this.onlineServers().length >= this.config.onlineServersLimit) return SafeInteract.reply(interaction, this.config.messages.errors.onlineServersLimitMessage);
                        
                        return server.start(interaction);
                    case 'stop':
                        if (!this.checkPermissions(interaction.member, this.config.stop.allowedPermissions, this.config.stop.allowedRoles)) return SafeInteract.reply(interaction, this.config.messages.process.noPermissions);
                        if (!server.scriptProcess) return SafeInteract.reply(interaction, this.config.messages.process.notRunning);
                        
                        return server.stop(interaction);
                    case 'restart':
                        if (!this.checkPermissions(interaction.member, this.config.restart.allowedPermissions, this.config.restart.allowedRoles)) return SafeInteract.reply(interaction, this.config.messages.process.noPermissions);
                        if (!server.scriptProcess) return SafeInteract.reply(interaction, this.config.messages.process.notRunning);

                        return server.restart(interaction);
                }
            }
        );
    }

    /**
     * 
     * @param {Discord.GuildMember} member 
     * @param {Object[]} allowedPermissions 
     * @param {Object[]} allowedRoles 
     * @returns 
     */
    checkPermissions(member, allowedPermissions, allowedRoles) {
        if (!member) return false;

        if (allowedPermissions.length && member.permissions.has(allowedPermissions)) return true;
        if (allowedRoles.length && member.roles.cache.some(role => allowedRoles.includes(role.id) || allowedRoles.includes(role.name))) return true;

        return false;
    }

    disabledCommands() {
        const disabledCommands = [...this.config.disabledCommands];

        if (!this.config.restart.enabled) disabledCommands.push('restart-server');
        if (!this.config.start.enabled) disabledCommands.push('start-server');
        if (!this.config.stop.enabled) disabledCommands.push('stop-server');
        
        return disabledCommands;
    }
}
