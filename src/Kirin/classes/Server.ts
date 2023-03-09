import { randomUUID } from 'crypto';
import { ActionRowBuilder, BaseMessageOptions, ButtonBuilder, ChannelType, Guild, GuildTextBasedChannel, If, InteractionButtonComponentData, Message, MessageActionRowComponentBuilder, PermissionResolvable, PermissionsBitField, StageChannel, TextBasedChannel } from 'discord.js';
import { Kirin } from '../../Kirin.js';
import { ServerManager } from './ServerManager.js';
import { readFileSync, rmSync, writeFileSync } from 'fs';
import { ChildProcess, spawn } from 'child_process';
import { PingData, pingServer } from '../utils/ping.js';
import { resolveFromCachedManager } from '../utils/managers.js';
import { Logger } from 'fallout-utility';
import path from 'path';
import { cwd } from 'reciple';

export interface ServerData {
    name: string;
    description?: string;
    file?: string;
    channelId?: string;
    messageId?: string;
    ip: string;
    server: {
        cwd: string;
        command: string;
        jar: string;
        args?: string[];
        killSignal?: NodeJS.Signals;
        killOnBotStop?: boolean;
    };
    messages: {
        offline: BaseMessageOptions;
        online: BaseMessageOptions;
        starting: BaseMessageOptions;
        stopping: BaseMessageOptions;
    };
    components: {
        start: InteractionButtonComponentData;
        stop: InteractionButtonComponentData;
    };
    permissions: {
        start: PermissionResolvable;
        stop: PermissionResolvable;
    };
    ping: {
        pingInterval: number;
        pingTimeout: number;
    };
}

export type ServerStatus = 'Online'|'Offline'|'Starting'|'Stopping';

export class Server<Ready extends boolean = boolean> {
    readonly id: string = randomUUID();
    readonly kirin: Kirin;
    readonly manager: ServerManager;
    readonly logger?: Logger;

    private _channel?: Exclude<GuildTextBasedChannel, StageChannel>|null = null;
    private _message?: Message|null = null;
    private _deleted: boolean = false;
    private _pingInterval?: NodeJS.Timer;

    get name() { return this.options.name; }
    get description() { return this.options.description; }
    get channelId() { return this.options.channelId; }
    get channel() { return this._channel as If<Ready, Exclude<GuildTextBasedChannel, StageChannel>|undefined>; }
    get guild() { return (this._channel !== null ? this._channel?.guild : null) as If<Ready, Guild|undefined>; }
    get messageId() { return this.options.messageId; }
    get message() { return this._message as If<Ready, Message|undefined>; }
    get ip() { return this.options.ip; }
    get host() { return this.options.ip.split(':')[0]; }
    get port() { return Number(this.options.ip.split(':')[1] ?? 25565); }
    get file() { return this.options.file; }
    get server() { return this.options.server; }
    get messages() { return this.options.messages; }
    get components() { return { start: new ButtonBuilder(this.options.components.start), stop: new ButtonBuilder(this.options.components.stop) }; }
    get permissions() { return { start: new PermissionsBitField(this.options.permissions.start), stop: new PermissionsBitField(this.options.permissions.stop) }; }

    get messageContent() {
        let content: BaseMessageOptions;

        switch (this.status) {
            case 'Offline':
                content = this.messages.offline;
                break;
            case 'Online':
                content = this.messages.online;
                break;
            case 'Starting':
                content = this.messages.starting;
                break;
            case 'Stopping':
                content = this.messages.stopping;
                break;
        }

        content.components = this.status !== 'Starting' && this.status !== 'Stopping'
            ? this.status === 'Online'
                ? [new ActionRowBuilder<MessageActionRowComponentBuilder>(this.components.stop.toJSON())]
                : [new ActionRowBuilder<MessageActionRowComponentBuilder>(this.components.start.toJSON())]
            : [];

        return content;
    }


    get status(): ServerStatus {
        if (this.process && this.lastPing?.status === 'Online') return 'Online';
        if (this.process && this.lastPing?.status === 'Offline') return 'Starting';
        if (!this.process && this.lastPing?.status === 'Offline') return 'Offline';
        if (!this.process && this.lastPing?.status === 'Online') return 'Stopping';

        return 'Offline';
    }

    get cwd () { return path.isAbsolute(this.server.cwd) ? this.server.cwd : path.join(cwd, this.server.cwd); }
    get cached() { return !!this.manager.cache.get(this.id); }
    get deleted() { return this._deleted; }

    public process?: ChildProcess;
    public lastPing?: PingData;

    constructor(readonly options: ServerData, kirin: Kirin) {
        this.kirin = kirin;
        this.manager = kirin.servers;
        this.logger = kirin.logger?.clone({ name: `Kirin/Server/${this.name}` })
    }

    public async start(): Promise<this> {
        if (!this.isStopped()) throw new Error('Server process is already started');

        this.logger?.warn(`Starting ${this.name}...`);
        this.logger?.debug(`Starting ${this.name}: Cwd: ${this.cwd}; Jar: ${this.server.jar}`);

        this.process = spawn(this.server.command, ["-jar", this.server.jar, ...(this.server.args ?? [])], {
            cwd: this.cwd,
            detached: !this.server.killOnBotStop,
            killSignal: this.server.killSignal,
            env: process.env,
            shell: true,
            stdio: [],
        });

        this.process.stdout?.on('data', (msg: Buffer) => this.manager.emit('serverProcessStdout', msg.toString('utf-8').trim(), this));
        this.process.stderr?.on('data', (msg: Buffer) => this.manager.emit('serverProcessStderr', msg.toString('utf-8').trim(), this));

        this.process.once('error', async err => {
            this.manager.emit('serverProcessError', err, this);
            await this.stop();
            this.logger?.error(err);
        });

        this.process.once('exit', async (code, signal) => {
            this.logger?.warn(`${this.name} exited! Code: ${code}; Signal: ${signal}`);
            this.process = undefined;
        });

        this.process.once('disconnect', async () => {
            this.logger?.warn(`${this.name} disconnected!`);
            await this.stop();
        });

        this.manager.emit('serverProcessStart', this.process, this);
        return this;
    }

    public async stop(): Promise<boolean> {
        if (!this.process) throw new Error('Server is already stopped');
        if (this.isStopped() || !this.process.pid) return true;

        this.logger?.warn(`Stopping ${this.name}...`);

        const kill = process.kill(this.process.pid!, this.server.killSignal);

        if (!kill) {
            if (this.isStopped()) {
                this.process = undefined;
                return true;
            }

            return new Promise(res => {
                const timeout = setTimeout(() => res(false), 1000 * 10);
                const handle = () => {
                    this.process = undefined;
                    clearTimeout(timeout);
                    res(true);
                }

                this.process?.once('disconnect', handle);
                this.process?.once('close', handle);
                this.process?.once('exit', handle);
            });
        }

        return true;
    }

    public async fetch(): Promise<Server<true>> {
        if (this.channelId) {
            const channel = await resolveFromCachedManager(this.channelId, this.kirin.client.channels);

            if (!channel.isTextBased()) throw new Error(`Channel (${this.channelId}) is not a text channel`);
            if (channel.isDMBased()) throw new Error(`Channel (${this.channelId}) is not a guild based channel`);
            if (channel.type === ChannelType.GuildStageVoice) throw new Error(`Stage channel is not supported`);

            this._channel = channel;
        }

        if (this.channelId && this.messageId) {
            const message = await resolveFromCachedManager(this.messageId, this.channel!.messages);
            if (message.author.id !== this.kirin.client.user?.id) throw new Error(`Message is not authored by ${this.kirin.client.user?.tag}`);

            this._message = message;
        }

        await this.ping();
        this.setPingInterval();

        return this as Server<true>;
    }

    public async delete(deleteJsonFile: boolean = false): Promise<void> {
        if (!this.isStopped() && (deleteJsonFile || this.server.killOnBotStop)) await this.stop();
        if (this._pingInterval) clearInterval(this._pingInterval);

        this.manager.emit('serverDelete', this as Server);
        this.manager.cache.delete(this.id);

        this._deleted = true;

        if (deleteJsonFile && this.file) rmSync(this.file, { force: true, recursive: true });
    }

    public async createMessage(options: { deleteOld?: boolean; channel?: Exclude<GuildTextBasedChannel, StageChannel> }): Promise<void> {
        if (!this.isFetched()) throw new Error('Server is not fetched');
        if (options.deleteOld === false && this.message) throw new Error('Server already has a message');
        if (!options.channel && !this.channel) throw new Error('Channel is required to send a message');

        await this.message?.delete();

        const channel = options.channel ?? this.channel;
        const message = await channel?.send(this.messageContent);

        this._message = message;
        this.options.messageId = message?.id;

        if (this.channelId !== channel?.id) {
            this._channel = channel;
            this.options.channelId = channel?.id;
        }

        this.saveJson();
    }

    public async ping(): Promise<PingData> {
        const oldPing = this.lastPing;
        const newPing = await pingServer({
            host: this.host,
            port: this.port,
            timeout: this.options.ping.pingTimeout
        });

        this.manager.emit('serverPing', oldPing, newPing, this);
        this.lastPing = newPing;
        return newPing;
    }

    public saveJson(file?: string): void {
        file = file ?? this.file;
        if (!file) throw new Error('No file path specified');

        writeFileSync(file, JSON.stringify(this.toJSON(true), null, 2));
    }

    public isFetched(): this is Server<true> {
        if (this.channelId && !this._channel) return false;
        if (this.messageId && this._message) return false;

        return true;
    }

    public isStopped(): boolean {
        return !this.process || !!this.process.exitCode || this.process.killed;
    }

    public setPingInterval(interval?: number) {
        if (this._pingInterval) clearInterval(this._pingInterval);

        this._pingInterval = setInterval(async () => this.ping(), interval ?? this.options.ping.pingInterval);
    }

    public toJSON(serverData?: true): ServerData & { id: string; status: ServerStatus; };
    public toJSON(serverData?: false): ServerData;
    public toJSON(serverData: boolean = true): ServerData & { id?: string; status?: ServerStatus; } {
        return {
            ...(serverData ? { id: this.id, status: this.status } : {}),
            ...this.options
        };
    }

    public static async from(file: string, kirin: Kirin, cache: boolean = true): Promise<Server<true>> {
        if (cache) {
            const cached = kirin.servers.cache.find(s => s.file === file);
            if (cached) return cached;
        }

        const serverJson: ServerData = JSON.parse(readFileSync(file, 'utf-8'));
        const server: Server = new Server(serverJson, kirin);

        serverJson.file = file;

        await server.fetch();

        if (cache) {
            kirin.servers.cache.set(server.id, server);
            kirin.servers.emit('serverCreate', server);
        }

        return server;
    }

    public static validateServerData(obj: ServerData): asserts obj is ServerData {
        if (!obj || typeof obj !== 'object') return;

        if (!obj.name) throw new Error('Name is required');
        if (!obj.ip) throw new Error('Server IP is required');

        if (!obj.server) throw new Error('Property "server" is required');
        if (!obj.server.cwd) throw new Error('Server cwd is required');
        if (!obj.server.command) throw new Error('Server command is required');
        if (!obj.server.jar) throw new Error('Server jar is required');
        if (obj.server.args && !Array.isArray(obj.server.args)) throw new Error('Server args is not an array');

        if (!obj.messages) throw new Error('Property "messages" is required');

        const missingMessages = ['offline', 'online', 'starting', 'stopping'].filter(m => !Object.keys(obj.messages).includes(m));
        if (missingMessages.length) throw new Error(`Missing server messages: ${missingMessages.join(' ')}`);

        if (!obj.permissions) throw new Error('Property "permissions" is required');
        if (!obj.permissions.start) throw new Error('Start permissions is required');
        if (!obj.permissions.stop) throw new Error('Stop permissions is required');

        if (!obj.ping) throw new Error('Property "ping" is required');
        if (!obj.ping.pingInterval) throw new Error('Server ping interval is required');
        if (!obj.ping.pingTimeout) throw new Error('Server ping timeout is required');

        return;
    }
}
