const Kirin = require('../');
const { SafeMessage, SafeInteract } = require('../../../scripts/safeActions');
const MessageContent = require('./MessageContent');
const EventEmitter = require('events');
const Discord = require('discord.js');
const childProcess = require('child_process');

module.exports = class Server extends EventEmitter {
    /**
     * 
     * @param {Kirin} kirin - The Kirin instance
     * @param {string} interactionId - customId for start button
     * @param {string} startScript - start script file name
     * @param {string} startScriptPath - path to your startScript
     * @param {string} host - Hostname or IP address of the server
     * @param {number} port - Server port (default: 25565)
     * @param {Object} serverMessage - The message options
     * @param {string} serverMessage.name - The name of the server
     * @param {string} serverMessage.description - The description of the server
     * @param {string} serverMessage.iconURL - Icon URL of the server
     * @param {string} serverMessage.color - The color of server embed
     */
    constructor(kirin, interactionId, startScript, startScriptPath, host, port = 25565, serverMessage = { name: null, description: null, iconURL: null, color: Kirin.Client.AxisUtility.config.embedColor }) {
        super();

        this.kirin = kirin;
        this.logger = kirin.logger;
        this.isActive = true;
        this.status = 'OFFLINE';
        this.name = serverMessage.name;
        this.description = serverMessage.description;
        this.icon = serverMessage.iconURL;
        this.color = serverMessage.color;
        this.host = host;
        this.port = port;
        this.startScript = startScript;
        this.startScriptPath = startScriptPath;
        this.guild = null;
        this.channel = null;
        this.message = null;
        this.interactionId = interactionId;
        this.scriptProcess = null;
    }
    
    /**
     * 
     * @param {String} guildId 
     * @param {String} channelId 
     * @param {String} messageId 
     * @returns {Server}
     */
    async parse(guildId, channelId, messageId) {
        this.guild = guildId;
        this.channel = channelId;
        this.message = messageId;

        const getGuild = this.kirin.Client.guilds.cache.get(guildId) || await this.kirin.Client.guilds.fetch(guildId);
        if (!getGuild) throw new Error(`Guild not found`, `Kirin/${this.name}`);

        const getChannel = getGuild.channels.cache.get(channelId) || await getGuild.channels.fetch(channelId);
        if (!getChannel) throw new Error(`Channel not found`, `Kirin/${this.name}`);

        const getMessage = getChannel.messages.cache.get(messageId) || await getChannel.messages.fetch(messageId);
        if (!getMessage) throw new Error(`Message not found`, `Kirin/${this.name}`);

        this.guild = getGuild;
        this.channel = getChannel;
        this.message = getMessage;

        return this;
    }

    async ping() {
        const response = await this.kirin.minecraftProtocol.ping({ host: this.host, port: this.port, closeTimeout: this.kirin.config.pingServers.pingTimeoutMilliseconds }).catch(err => {
            if (!this.kirin.config.hidePingErrors) this.logger.error(`${this.name} ping error: ${err.message}`, `Kirin/${this.name}`);

            return {
                status: 'OFFLINE',
                players: {
                    online: 0,
                    max: 0
                },
                version: {
                    name: 'Unknown',
                    protocol: NaN
                },
                latency: NaN
            };
        });

        response.status = (this.kirin.config.pingServers.zeroMaxServersAsOffline && !response.players.max) ? 'OFFLINE' : 'ONLINE';
        this.emit('ping', response);
        this.status = response.status;

        return response;
    }

    async refreshMessage() {
        if (!this.message) throw new Error(`Message not found`, `Kirin/${this.name}`);

        const newContent = await new MessageContent(this).addContents();

        this.message = await SafeMessage.edit(this.message, newContent.content) || this.message;
        this.emit('messageChange', this);

        if(this.isActive) setTimeout(() => this.refreshMessage(), this.kirin.config.pingServers.pingIntervalMilliseconds);
        return true;
    }

    /**
     * 
     * @param {Discord.ButtonInteraction} interaction 
     * @returns {Boolean}
     */
    interactionFilter(interaction) {
        return interaction.isButton();
    }

    /**
     * 
     * @param {Discord.ButtonInteraction} interaction 
     * @returns 
     */
    async start(interaction) {
        if (!this.kirin.config.start.enabled) return SafeInteract.reply(interaction, this.kirin.config.messages.process.disabled); 
        this.logger.warn(`Starting ${this.name} by ${interaction.user.tag}`, `Kirin/${this.name}`);

        if (this.scriptProcess) {
            this.logger.warn(`${this.name} already running`, `Kirin/${this.name}`);
            return SafeInteract.reply(interaction, this.kirin.config.messages.process.alreadyRunning);
        }

        const spawnProcess = this.spawnProcess();
        this.emit('start', spawnProcess ? null : new Error('Cannot spawn process'));

        return SafeInteract.reply(interaction, spawnProcess ? this.kirin.config.messages.process.starting : this.kirin.config.messages.errors.start);
    }

    /**
     * 
     * @param {Discord.ButtonInteraction} interaction 
     * @returns 
     */
    async stop(interaction) {
        if (!this.kirin.config.stop.enabled) return SafeInteract.reply(interaction, this.kirin.config.messages.process.disabled);
        this.logger.warn(`Stopping ${this.name} by ${interaction.user.tag}`, `Kirin/${this.name}`);

        if (!this.scriptProcess) {
            this.logger.error(`${this.name} is not connected to Kirin`, `Kirin/${this.name}`);
            return SafeInteract.reply(interaction, this.kirin.config.messages.process.notRunning);
        }

        const closeProcess = this.closeProcess();
        this.emit('stop', closeProcess ? null : new Error('Could not stop process'));

        return SafeInteract.reply(interaction, closeProcess ? this.kirin.config.messages.process.stopping : this.kirin.config.messages.errors.stop);
    }

    /**
     * 
     * @param {Discord.ButtonInteraction} interaction 
     * @returns 
     */
    async restart(interaction) {
        if (!this.kirin.config.restart.enabled) return SafeInteract.reply(interaction, this.kirin.config.messages.process.disabled);
        this.logger.warn(`Restarting ${this.name} by ${interaction.user.tag}`, `Kirin/${this.name}`);

        if (!this.scriptProcess) {
            this.logger.error(`${this.name} is not connected to Kirin`, `Kirin/${this.name}`);
            return SafeInteract.reply(interaction, this.kirin.config.messages.process.notRunning);
        }

        const closeProcess = this.closeProcess();
        if (!closeProcess) return SafeInteract.reply(interaction, this.kirin.config.messages.errors.restart);

        this.scriptProcess.on('exit', async (code) => {
            await this.sleep(1000);
            this.logger.warn(`Restarting ${this.name} | Exit code ${code}`, `Kirin/${this.name}`);
            if (this.spawnProcess()) {
                this.logger.warn(`Starting ${this.name} | Restarted`, `Kirin/${this.name}`);
                this.emit('restart', null);
            } else {
                this.logger.error(`Restarting ${this.name} | Failed to spawn`, `Kirin/${this.name}`);
                this.emit('restart', new Error(`Failed to spawn child process`));
            }
        });

        return SafeInteract.reply(interaction, this.kirin.config.messages.process.restarting);
    }

    closeProcess() {
        if (!this.scriptProcess) return false;
        if (this.scriptProcess.killed || !this.scriptProcess?.pid) return false;
        if (this.scriptProcess.kill(this.kirin.config.stopSignal)) {
            this.logger.warn(`${this.name} | PID: ${this.scriptProcess.pid} killed with ${this.kirin.config.stopSignal}`, `Kirin/${this.name}`);
            return true;
        } else {
            this.logger.error(`${this.name} | PID: ${this.scriptProcess.pid} unable to kill with ${this.kirin.config.stopSignal}`, `Kirin/${this.name}`);
            return false;
        }
    }

    spawnProcess() {
        this.logger.warn(`Starting: ${this.startScript}`, `Kirin/${this.name}`);

        const script = this.startScript.split(' ');
        this.scriptProcess = childProcess.spawn(script.shift(), script, {
            silent: true,
            async: true,
            cwd: this.startScriptPath || './',
            detached: !this.kirin.config.stopServerOnExit
        });

        this.scriptProcess.stdout.on('data', (message) => this.kirin.config.displayConsoleMessages ? this.logger.info(message.toString().trim(), `Kirin/${this.name}|Console/STDOUT`) : null);
        this.scriptProcess.stderr.on('data', (message) => this.kirin.config.displayConsoleMessages ? this.logger.error(message.toString().trim(), `Kirin/${this.name}|Console/STDERR`) : null);
        this.scriptProcess.stdin.on('data', (message) => this.kirin.config.displayConsoleMessages ? this.logger.warn(message.toString().trim(), `Kirin/${this.name}|Console/STDIN`) : null);

        this.scriptProcess.on('error', (message) => this.kirin.config.displayConsoleMessages ? this.logger.error(message, `Kirin/${this.name}`) : null);
        this.scriptProcess.once('disconnect', () => this.scriptProcess = null);
        this.scriptProcess.once('close', code => {
            this.logger.warn(`${this.name} closed with code ${code}`, `Kirin/${this.name}`);
            this.closeProcess();
            this.scriptProcess = null;
        });
        this.scriptProcess.once('exit', code => {
            this.logger.warn(`${this.name} exited with code ${code}`, `Kirin/${this.name}`);
            this.closeProcess();
            this.scriptProcess = null;
        });

        return !!this.scriptProcess;
    }

    sleep(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }
}
