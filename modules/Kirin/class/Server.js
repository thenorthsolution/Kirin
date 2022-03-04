const Kirin = require('../');
const shelljs = require('shelljs');
const { SafeMessage, SafeInteract } = require('../../../scripts/safeActions');
const MessageContent = require('./MessageContent');
const EventEmitter = require('events');
const Discord = require('discord.js');

module.exports = class Server extends EventEmitter {
    /**
     * 
     * @param {Kirin} kirin - The Kirin instance
     * @param {string} host - Hostname or IP address of the server
     * @param {number} port - Server port (default: 25565)
     * @param {Object} serverMessage - The message options
     * @param {string} serverMessage.name - The name of the server
     * @param {string} serverMessage.description - The description of the server
     * @param {string} serverMessage.iconURL - Icon URL of the server
     * @param {string} serverMessage.color - The color of server embed
     */
    constructor(kirin, interactionId, host, port = 25565, serverMessage = { name: null, description: null, iconURL: null, color: Kirin.Client.AxisUtility.config.embedColor }) {
        super();

        this.kirin = kirin;
        this.isActive = true;
        this.name = serverMessage.name;
        this.description = serverMessage.description;
        this.icon = serverMessage.iconURL;
        this.color = serverMessage.color;
        this.host = host;
        this.port = port;
        this.startScript = null;
        this.guild = null;
        this.channel = null;
        this.message = null;
        this.interactionId = interactionId;
        this.scriptProcess = null;
    }
    
    async parse(guildId, channelId, messageId) {
        this.guild = guild;
        this.channel = channel;
        this.message = message;

        const getGuild = this.kirin.Client.guilds.cache.get(guildId) || await this.kirin.Client.guilds.fetch(guildId);
        if (!getGuild) throw new Error(`Guild not found`, `Kirin/${this.name}`);

        const getChannel = getGuild.channels.cache.get(channelId) || await getGuild.channels.fetch(channelId);
        if (!getChannel) throw new Error(`Channel not found`, `Kirin/${this.name}`);

        const getMessage = getChannel.messages.cache.get(messageId) || await getChannel.messages.fetch(messageId);
        if (!getMessage) throw new Error(`Message not found`, `Kirin/${this.name}`);

        return this;
    }

    async ping() {
        const response = await this.kirin.minecraftProtocol.ping({ host: this.host, port: this.port, closeTimeout: this.kirin.config.pingServers.pingTimeoutMilliseconds }).catch(err => {
            this.logger.error(`${this.name} ping error`, `Kirin/${this.name}`);
            this.logger.error(err, `Kirin/${this.name}`);

            return {
                status: 'OFFLINE',
                players: {
                    online: 0,
                    max: 0
                },
                version: null,
                latency: NaN
            };
        });

        response.status = (this.kirin.config.pingServers.zeroMaxServersAsOffline && !response.maxPlayers) ? 'OFFLINE' : 'ONLINE';
        this.emit('ping', response);

        return response;
    }

    async refreshMessages() {
        if (!this.message) throw new Error(`Message not found`, `Kirin/${this.name}`);

        const newContent = new MessageContent(this).addContents();

        await SafeMessage.edit(this.message, newContent);
        this.emit('messageChange', this);

        return this.isActive ? setTimeout(() => this.refreshMessages(), this.kirin.config.pingServers.pingIntervalMilliseconds) : true;
    }

    /**
     * 
     * @param {Discord.ButtonInteraction} interaction 
     * @returns {Boolean}
     */
    interactionFilter(interaction) {
        if (interaction.type !== 'MESSAGE_COMPONENT') return false;
        if (interaction?.customId !== this.interactionId) return false;
        if ((interaction.memberPermissions && this.kirin.config.serverStartPermissions) && !interaction.memberPermissions.has(this.kirin.config.serverStartPermissions)) return false;

        return true;
    }

    /**
     * 
     * @param {Discord.ButtonInteraction} interaction 
     * @returns 
     */
    async start(interaction) {
        this.logger.info(`Starting ${this.name}`, `Kirin/${this.name}`);
        this.isActive = true;

        if (this.scriptProcess) {
            this.logger.warn(`${this.name} already running`, `Kirin/${this.name}`);
            return SafeInteract.reply(interaction, this.kirin.config.messages.process.alreadyRunning);
        }

        this.scriptProcess = shelljs.exec(this.startScript, { silent: true, async: true });
        this.scriptProcess.once('close', code => {
            this.logger.info(`${this.name} stopped with code ${code}`, `Kirin/${this.name}`);
            this.closeProcess();
        });
        this.scriptProcess.once('exit', code => {
            this.logger.info(`${this.name} stopped with code ${code}`, `Kirin/${this.name}`);
            this.closeProcess();
        });
    }
    
    closeProcess() {
        if (!this.scriptProcess) return this;

        if (!this.scriptProcess.killed) this.scriptProcess.kill();
        this.scriptProcess = null;

        return this;
    }
}