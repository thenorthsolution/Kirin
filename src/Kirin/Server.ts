import { NewPingResult, OldPingResult, ping } from 'minecraft-protocol';
import { KirinModule, KirinServerConfig } from './';
import { Logger, splitString } from 'fallout-utility';
import EventEmitter from 'events';
import discord from 'discord.js';
import { RecipleClient } from 'reciple';
import { MessageContent } from './MessageContent';
import childProcess from 'child_process';

export type serverStatus = 'ONLINE' | 'OFFLINE';

export interface KirinServerOptions extends KirinServerConfig {
    host: string;
    port: number;
    script: string;
    scriptRootDir: string;
    displayName: string;
    description: string;
    channelId: string;
    messageId: string;
}

export interface PingData {
    status: serverStatus;
    online: boolean;
    version: string;
    players: {
        max: number;
        online: number;
    }
}

export class KirinServer extends EventEmitter {
    public id: string;
    public deleted: boolean = false;
    public kirin: KirinModule;
    public client: RecipleClient;
    public config: KirinServerOptions;
    public logger: Logger;
    public lastPingData?: PingData;
    public process?: childProcess.ChildProcess;
    public status: serverStatus = 'ONLINE';
    public channel!: discord.TextChannel;
    public message!: discord.Message;

    constructor (options: KirinServerOptions, kirin: KirinModule) {
        super();
        
        if (!options.host) throw new TypeError(`Host is required`);
        if (!options.port) throw new TypeError(`Port is required`);
        if (!options.start) throw new TypeError(`Start is required`);
        if (!options.stop) throw new TypeError(`Stop is required`);
        if (!options.restart) throw new TypeError(`Restart is required`);
        if (!options.stopSignal) throw new TypeError(`StopSignal is required`);
        if (!options.pingOptions) throw new TypeError(`PingOptions is required`);

        this.id = (Math.random() + 1).toString(36).substring(7).toLowerCase();

        this.kirin = kirin;
        this.client = this.kirin.client;
        this.config = options;
        this.logger = this.kirin.client.logger.cloneLogger();

        this.logger.defaultPrefix = `${this.config.host}:${this.config.port}`;
    }

    public async init() {
        const channel = this.client.channels.cache.get(this.config.channelId) ?? await this.client.channels.fetch(this.config.channelId).catch(err => this.logger.error(err)) ?? undefined;
        if (!channel || channel?.type !== 'GUILD_TEXT') throw new TypeError(`Channel is not a guild text channel`);

        const message = channel.messages.cache.get(this.config.messageId) ?? await channel.messages.fetch(this.config.messageId).catch(err => this.logger.error(err)) ?? undefined;
        if (!message || message.author.id !== this.client.user?.id) throw new TypeError(`Message is not found or not from this bot`);

        this.channel = channel;
        this.message = message;

        return this.ping(true);
    }

    public async ping(repeat: boolean = false, sleep?: number) {
        sleep = this.config.pingOptions?.pingIntervalMs ?? sleep;
        if (sleep && this.lastPingData) await new Promise(resolve => setTimeout(resolve, sleep));
        if (this.deleted) return;

        let data = await ping({
            host: this.config.host,
            port: this.config.port,
            closeTimeout: this.config.pingOptions?.pingTimeoutMs || 5000,
        })
        .catch(err => {
            if (this.config.displayPingErrors) this.logger.error(err);

            const res: NewPingResult = {
                description: 'OFFLINE',
                latency: 0,
                version: {
                    name: '',
                    protocol: 0
                },
                players: {
                    max: 0,
                    online: 0
                }
            };

            return res;
        });

        if ((data as OldPingResult).maxPlayers) {
            if (repeat) this.ping(repeat, sleep);
            return;
        }

        data = data as NewPingResult;
        
        this.lastPingData = {
            online: data.description === 'OFFLINE' && !data.latency,
            version: data.version.name,
            players: {
                max: data.players.max,
                online: data.players.online,
            },
            status: data.description === 'OFFLINE' ? 'OFFLINE' : 'ONLINE'
        };
        
        this.status = this.lastPingData.status;
        this.emit('pingUpdate', data, this.lastPingData);
        this.updateMessage();

        if (repeat) this.ping(repeat, sleep);
    }

    public async updateMessage() {
        const messageContent = new MessageContent(this).getMessage();
        return this.message.edit(messageContent).catch(err => this.logger.error(err));
    }

    public async start() {
        if (this.process) throw new Error(`ERROR: ${this.kirin.getMessage('alreadyRunning', this.config.displayName)}`);
        if (this.deleted) throw new Error(`ERROR: ${this.kirin.getMessage('deleted', this.config.displayName)}`);
        this.logger.warn(`Starting ${this.config.displayName}...`);

        const script = splitString(this.config.script, false, ' ');
        this.process = childProcess.spawn(script.shift() ?? 'exit', script, {
            cwd: this.config.scriptRootDir || process.cwd(),
            env: process.env,
            detached: !this.config.stopServerOnExit
        });

        if (this.config.printToConsole) {
            this.process.stdout?.on('data', data => this.logger.info(data.toString().trim()));
            this.process.stdin?.on('data', data => this.logger.warn(data.toString().trim()));
            this.process.stderr?.on('data', data => this.logger.error(data.toString().trim()));
        }

        this.process.on('error', err => this.logger.error(err));
        this.process.on('disconnect', () => this.process = undefined);
        this.process.once('close', code => {
            this.logger.warn(`${this.config.displayName} closed with code ${code}`);
            this.process = undefined;
        });
        this.process.once('exit', code => {
            this.logger.warn(`${this.config.displayName} exited with code ${code}`);
            this.process = undefined;
        });

        this.emit('start', this.process);
        return true;
    }

    public async stop() {
        if (!this.process) throw new Error(`ERROR: ${this.kirin.getMessage('notRunning', this.config.displayName)}`);
        if (this.deleted) throw new Error(`ERROR: ${this.kirin.getMessage('deleted', this.config.displayName)}`);
        if (this.process.killed || !this.process.pid) {
            this.process = undefined;
            throw new Error(`ERROR: ${this.kirin.getMessage('notRunning', this.config.displayName)}`);
        }

        this.logger.warn(`Stopping ${this.config.displayName}...`);
        const stop = this.process.kill(this.config.stopSignal);

        if (!stop) throw new Error(`ERROR: ${this.kirin.getMessage('canNotStop', this.config.displayName)}`);

        this.emit('stop', this.process);
        return stop;
    }
}