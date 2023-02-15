import { ChildProcess, spawn } from 'child_process';
import { KirinModule } from '../../kirin.mjs';
import { Awaitable, Collection, If, Message, MessageManager, TextBasedChannel } from 'discord.js';
import { randomUUID } from 'crypto';
import { ServerConfig } from '../utils/serversConfig.mjs';
import { TypedEmitter } from 'tiny-typed-emitter';
import { Logger, LoggerLevel, path } from 'fallout-utility';
import { NewPingResult, ping } from 'minecraft-protocol';
import { setTimeout } from 'timers/promises';
import { setTimeout as setTimeoutSync } from 'timers';
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
    get cwd() { return this.options.server.cwd }
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

    public async start(): Promise<this> {
        if (this.process) throw new Error(`Process is already started`);

        this.logger?.warn(`Starting ${this.name}:\n`, `  cwd: ${this.cwd}\n`, `  cmd: ${this.startCommand}`);

        this.process = spawn(this.options.server.serverExecutable, this.options.server.args ?? [], {
            cwd: path.resolve(this.options.server.cwd),
            env: { ...process.env, FORCE_COLOR: 'true' },
            detached: !(this.options.stopServerOnExit ?? this.kirin.config.defaults.stopServerOnExit),
            killSignal: this.options.killSignal || this.kirin.config.defaults.killSignal || undefined,
            shell: true
        });

        this.process.stdout?.on('data', data => this.logServerMessage(LoggerLevel.INFO, data.toString('utf-8').trim()));
        this.process.stderr?.on('data', data => this.logServerMessage(LoggerLevel.ERROR, data.toString('utf-8').trim()));

        this.process.on('error', (data) => this.logger?.err(data));

        this.process.once('close', async (code, signal) => {
            this.logger?.log(`${this.name} closed: ${code}; signal: ${signal}`);
            await this.stop();
        });

        return this;
    }

    public async stop(): Promise<boolean> {
        if (!this.process || this.process.killed || !this.process.connected) return true;

        if (this.process.kill(this.killSignal)) {
            if (!this.process || this.process.killed) return true;

            return new Promise((res, rej) => {
                const timeout = setTimeoutSync(() => res(false), 5000);

                this.process?.once('close', () => { res(true); clearTimeout(timeout); });
                this.process?.once('exit', () => { res(true); clearTimeout(timeout); });
            });
        }

        return false;
    }

    public async ping(loop: boolean = false): Promise<ServerPingData|null> {
        if (!loop && !this.deleted) throw new Error(`This server has already been deleted!`);
        if (loop && this.deleted) return null;

        const data = await Server.pingServer({ host: this.host, port: this.port, timeout: this.kirin.config.ping.pingTimeoutMs });

        this.emit('ping', data);
        this.logger?.debug(`Pinged ${this.ip}! Current server status: ${data.status}`);

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

    protected logServerMessage(level: LoggerLevel, message: string): void {
        switch (level) {
            case LoggerLevel.INFO:
                this.logger?.log(message);
                break;
            case LoggerLevel.ERROR:
                this.logger?.err(message);
                break;
            case LoggerLevel.WARN:
                this.logger?.warn(message);
                break;
            case LoggerLevel.DEBUG:
                this.logger?.err(message);
                break;
        }
    }

    public static async fetchServers(kirin: KirinModule, ping: boolean = false): Promise<Collection<string, Server<true>>> {
        const servers: Collection<string, Server<true>> = new Collection();

        for (const serverConfig of kirin.serversConfig) {
            const server = new Server({
                kirin,
                ...serverConfig
            });

            try {
                await server.load();
                servers.set(server.id, server);

                if (ping) server.ping(true);
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
