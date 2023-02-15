import { ChildProcess } from 'child_process';
import { KirinModule } from '../../kirin.mjs';
import { Awaitable, Collection, If, Message, MessageManager, TextBasedChannel } from 'discord.js';
import { randomUUID } from 'crypto';
import { ServerConfig } from '../utils/serversConfig.mjs';
import { TypedEmitter } from 'tiny-typed-emitter';
import { Logger } from 'fallout-utility';
import { NewPingResult, ping } from 'minecraft-protocol';
import { setTimeout } from 'timers/promises';
import { EventEmitter } from 'events';
import { MessageContent } from './MessageContent.mjs';

export interface ServerOptions extends ServerConfig {
    kirin: KirinModule;
}

export interface ServerPingData {
    status: 'ONLINE'|'OFFLINE';
    players: {
        max: number;
        online: number;
    },
    version: string;
    latency: number;
    pingedAt: Date;
}

export interface ServerEvents {
    ping: (pingData: ServerPingData) => Awaitable<void>;
    pingIntervalStop: () => Awaitable<void>;
    statusUpdate: (oldPingData: ServerPingData|undefined, newPingData: ServerPingData) => Awaitable<void>;
}

export class Server<Ready extends boolean = boolean> extends TypedEmitter<ServerEvents> {
    private _channel: TextBasedChannel|null = null;
    private _message: Message|null = null;
    private _stopPingInterval: boolean = false;

    readonly id: string;
    readonly kirin: KirinModule;
    readonly logger?: Logger;
    readonly messageContent: MessageContent;

    public process?: ChildProcess;
    public lastPingData?: ServerPingData;
    public deleted: boolean = false;

    get name() { return this.options.name };
    get description() { return this.options.description; }
    get host() { return this.options.connection?.host ?? 'locahost' }
    get port() { return this.options.connection?.port }
    get ip() { return this.host + (typeof this.port === 'number' ? ':' + this.port : '') }
    get killSignal() { return this.options.killSignal; }
    get channel() { return this._channel as If<Ready, TextBasedChannel>; }
    get message() { return this._message as If<Ready, Message>; }
    get client() { return this.kirin.client; }
    get startCommand() { return `${this.options.server.serverExecutable} ${this.options.server.args.join(' ')}`.trim() }

    constructor(readonly options: ServerOptions) {
        super();

        this.id = randomUUID();
        this.kirin = options.kirin;
        this.messageContent = new MessageContent(this);

        this.logger = this.kirin.logger?.clone({ name: `Kirin/${this.options.name}` });
    }

    public async load(): Promise<Server<true>> {
        const channel = await this.kirin.resolveFromCachedManager(this.options.message.channelId, this.client.channels);
        if (!channel || !channel.isTextBased()) {
            await this.delete();
            throw new Error(`Couldn't load valid text channel '${this.options.message.channelId}'`);
        }

        const message = await this.kirin.resolveFromCachedManager(this.options.message.messageId, channel.messages as MessageManager);
        if (!message || message.author.id !== this.client.user?.id) {
            await this.delete();
            throw new Error(`Couldn't load bot message '${this.options.message.messageId}'`);
        }

        this._channel = channel;
        this._message = message;

        return this as Server<true>;
    }

    public async ping(loop: boolean = false): Promise<ServerPingData|null> {
        if (!loop && !this.deleted) throw new Error(`This server has already been deleted!`);
        if (loop && this.deleted) return null;

        const data = await Server.pingServer({ host: this.host, port: this.port, timeout: this.kirin.config.ping.pingTimeoutMs });

        this.emit('ping', data);

        if (this.lastPingData?.status !== data.status) this.emit('statusUpdate', this.lastPingData, data);

        this.lastPingData = data;

        if (loop) {
            if (this._stopPingInterval) {
                this._stopPingInterval = false;
                this.emit('pingIntervalStop');

                await this.updateMessageContent().catch(() => {});
                return data;
            }

            await setTimeout(this.kirin.config.ping.pingIntervalMs);
            return this.ping(loop);
        }

        return data;
    }

    public async updateMessageContent(): Promise<Message> {
        if (!this.isReady()) throw new Error(`Coudln't edit server message`);

        await this.message.edit(this.messageContent.parse());

        return this.message;
    }

    public isReady(): this is Server<true> {
        return !!this._channel && !!this._message;
    }

    public async delete(): Promise<this> {
        this.deleted = true;

        return this;
    }

    public async stopPingInterval(): Promise<void> {
        if (this._stopPingInterval) return;
        await EventEmitter.once(this, 'pingIntervalStop');
    }

    public static async fetchServers(kirin: KirinModule): Promise<Collection<string, Server<true>>> {
        const servers: Collection<string, Server<true>> = new Collection();

        for (const serverConfig of kirin.serversConfig) {
            const server = new Server({
                kirin,
                ...serverConfig
            });

            try {
                await server.load();
                servers.set(server.id, server);
            } catch (err) {
                server.logger?.err(`Unable to load server '${server.name}':\n`, err);
            }
        }

        return servers;
    }

    public static async pingServer(options: { host: string, port?: number; timeout?: number }): Promise<ServerPingData> {
        const pingData = await ping({
            host: options.host,
            port: options.port,
            closeTimeout: options.timeout
        }).catch(() => null);

        let status: ServerPingData = {
            status: 'OFFLINE',
            players: { max: 0, online: 0 },
            version: '',
            latency: 0,
            pingedAt: new Date()
        };

        if (!pingData) return status;
        if (typeof (pingData as NewPingResult).players === 'undefined') return status;

        const newPingResult = pingData as NewPingResult;

        status.status = 'ONLINE';
        status.players = newPingResult.players;
        status.latency = newPingResult.latency;
        status.version = newPingResult.version.name;

        return status;
    }
}
