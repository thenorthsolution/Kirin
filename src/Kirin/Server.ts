import { ChildProcess, spawn } from 'child_process';
import { Logger, splitString } from 'fallout-utility';
import { KirinMain } from '../kirin';
import EventEmitter from 'events';
import { GuildTextBasedChannel, Message } from 'discord.js';
import { NewPingResult, OldPingResult, ping } from 'minecraft-protocol';
import { MessageContent } from './MessageContent';

export type Action = 'start'|'stop';
export type ServerStatus = 'ONLINE'|'OFFLINE';

export interface PingData {
    status: ServerStatus;
    players: {
        online: number;
        max: number;
    };
    latency: number;
    version: string;
}

export interface ServerOptions {
    name?: string;
    description?: string;
    id: string;
    start_script: string;
    server_root: string;
    stop_signal: NodeJS.Signals;
    host: string;
    port: number;
    channel_id: string;
    message_id: string;
    kirin: KirinMain;
}

export interface ServerEvents {
    ping: [pingData: PingData];
    messageUpdate: [message: Message];
    start: []
}

export interface Server extends EventEmitter {
    on<E extends keyof ServerEvents>(event: E, listener: (...args: ServerEvents[E]) => void|Promise<void>): this;
    on<E extends string|symbol>(event: Exclude<E, keyof ServerEvents>, listener: (...args: any) => void|Promise<void>): this;

    once<E extends keyof ServerEvents>(event: E, listener: (...args: ServerEvents[E]) => void|Promise<void>): this;
    once<E extends string|symbol>(event: Exclude<E, keyof ServerEvents>, listener: (...args: any) => void|Promise<void>): this;

    emit<E extends keyof ServerEvents>(event: E, ...args: ServerEvents[E]): boolean;
    emit<E extends string|symbol>(event: Exclude<E, keyof ServerEvents>, ...args: any): boolean;

    off<E extends keyof ServerEvents>(event: E, listener: (...args: ServerEvents[E]) => void|Promise<void>): this;
    off<E extends string|symbol>(event: Exclude<E, keyof ServerEvents>, listener: (...args: any) => void|Promise<void>): this;

    removeAllListeners<E extends keyof ServerEvents>(event?: E): this;
    removeAllListeners(event?: string|symbol): this;
}

export class Server extends EventEmitter {
    public options: ServerOptions;
    public id: string;
    public script: string;
    public root: string;
    public stopSignal: NodeJS.Signals;
    public host: string;
    public port: number;
    public channel?: GuildTextBasedChannel;
    public message?: Message;
    public kirin: KirinMain;
    public status: ServerStatus = 'OFFLINE';
    public logger: Logger;
    public process?: ChildProcess;
    public lastPingData?: PingData;
    public deleted: boolean = false;

    constructor (options: ServerOptions) {
        super();

        this.options = options;
        this.id = options.id;
        this.script = options.start_script;
        this.root = options.server_root;
        this.stopSignal = options.stop_signal;
        this.host = options.host;
        this.port = options.port;
        this.kirin = options.kirin;
        this.logger = this.kirin.logger.cloneLogger({ loggerName: this.options.name ?? this.id });

        if (options.channel_id == '000000000000000000' || options.message_id == '000000000000000000') {
            this.delete();
            throw new TypeError(`Invalid channel or message id`);
        }
    }

    public start(): void {
        if (this.process) throw new Error('Process is already running');
        this.logger.debug(`Starting ${this.id}`);

        const [command, ...args] = splitString(this.script, true);
        
        this.process = spawn(command, args, {
            cwd: this.root,
            env: process.env,
            detached: !this.kirin.config.process.stopServersOnExit,
            killSignal: this.stopSignal,
        });

        this.process.stdout?.on('data', (message) => this.kirin.config.process.showConsoleMessages ? this.logger.log(message.toString().trim()) : this.logger.debug(message.toString().trim()));
        this.process.stderr?.on('data', (message) => this.kirin.config.process.showConsoleMessages ? this.logger.error(message.toString().trim()) : this.logger.debug(message.toString().trim()));
        this.process.stdin?.on('data', (message) => this.kirin.config.process.showConsoleMessages ? this.logger.log(message.toString().trim()) : this.logger.debug(message.toString().trim()));
        this.process.on('error', (message) => this.kirin.config.process.showConsoleMessages ? this.logger.error(message) : this.logger.debug(message));

        this.process.on('close', (code, signal) => {
            this.logger.log(`${this.id} closed: ${code}; signal: ${signal}`);
            this.process = undefined;
        });

        this.process.on('exit', (code, signal) => {
            this.logger.log(`${this.id} exited: ${code}; signal: ${signal}`);
            this.process = undefined;
        });
    }

    public async stop(): Promise<boolean> {
        if (!this.process) throw new Error('Process is already stopped');

        if (this.process.kill(this.stopSignal)) {
            if (!this.process || this.process.killed) return true;

            return new Promise((res, rej) => {
                const timeout = setTimeout(() => rej(new Error('Failed to stop process')), 3000);

                this.process?.once('close', () => { res(true); clearTimeout(timeout); });
                this.process?.once('exit', () => { res(true); clearTimeout(timeout); });
            });
        } else {
            return false;
        }
    }

    public async ping(loop: boolean): Promise<undefined|NewPingResult> {
        const response = await ping({ host: this.host, port: this.port, closeTimeout: this.kirin.config.ping.pingTimeoutMs })
            .then(result => {
                if ((result as OldPingResult)?.motd) return undefined;
                return result as NewPingResult;
            })
            .catch(err => {
                if (this.kirin.config.ping.showPingErrorMessages) this.logger.err(err);
            });

        const status = this.kirin.config.ping.zeroMaxServersAsOffline && !response?.players.max || !response ? 'OFFLINE' : 'ONLINE';
        this.status = status;
        this.lastPingData = {
            status,
            latency: response?.latency ?? 0,
            players: response?.players ?? { max: 0, online: 0 },
            version: response?.version.name ?? 'unknown'
        };

        await this.updateMessage();
        this.logger.debug(`Ping status updated!`);
        this.emit('ping', this.lastPingData);
        if (loop) setTimeout(() => this.ping(loop), this.kirin.config.ping.pingIntervalMs);
        return response ? response : undefined;
    }

    public async updateMessage(): Promise<void> {
        if (!this.message) throw new Error(`Message is not defined`);

        await this.message.edit(new MessageContent(this).getData())
        .then(message => {
            this.logger.debug(`Updated ${this.id} message: ${message.id}`)
            this.emit('messageUpdate', message);
        })
        .catch(err => this.logger.debug('Edit Message Error', err));
    }

    public async fetch(): Promise<Server> {
        const channel = this.kirin.client.channels.cache.get(this.options.channel_id) ?? await this.kirin.client.channels.fetch(this.options.channel_id).catch(err => this.logger.err(err));
        if (!channel?.isTextBased()) {
            this.delete();
            throw new TypeError(`Unknown guild channel: ${this.options.channel_id}`);
        }

        this.channel = channel as GuildTextBasedChannel;
        
        const message = this.channel.messages.cache.get(this.options.message_id) ?? await this.channel.messages.fetch(this.options.message_id).catch(err => this.logger.err(err));
        if (!message) {
            this.delete();
            throw new TypeError(`Unknown message: ${this.options.message_id}`);
        }

        if (message.author.id !== this.kirin.client.user?.id || !message.editable) {
            this.delete();
            throw new Error(`${this.kirin.client.user?.id} is not the author of message: ${message.id}`);
        }

        this.message = message;
        return this;
    }

    public delete(): void {
        this.deleted = true;
    }
}
