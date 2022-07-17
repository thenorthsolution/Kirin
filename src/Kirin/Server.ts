import { ChildProcess } from 'child_process';
import { Logger } from 'fallout-utility';
import { KirinMain } from '../kirin';
import EventEmitter from 'events';
import { GuildTextBasedChannel, Message } from 'discord.js';
import { NewPingResult, OldPingResult, ping } from 'minecraft-protocol';
import { MessageContent } from './MessageContent';

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

        this.updateMessage();
        this.emit('ping', this.lastPingData);
        if (loop) await this.ping(loop);
        return response ? response : undefined;
    }

    public async updateMessage(): Promise<void> {
        if (!this.message) throw new Error(`Message is not defined`);

        await this.message.edit(new MessageContent(this).getData()).catch(() => {});
        this.emit('messageUpdate', this.message);
    }

    public async fetch(): Promise<Server> {
        const channel = this.kirin.client.channels.cache.get(this.options.channel_id) ?? await this.kirin.client.channels.fetch(this.options.channel_id).catch(() => undefined);
        if (!channel?.isText()) {
            this.delete();
            throw new TypeError(`Unknown guild channel: ${this.options.channel_id}`);
        }

        this.channel = channel as GuildTextBasedChannel;
        
        const message = this.channel.messages.cache.get(this.options.message_id) ?? await this.channel.messages.fetch(this.options.message_id).catch(() => undefined);
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
