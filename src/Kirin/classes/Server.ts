import { APIButtonComponentBase, BaseMessageOptions, ButtonBuilder, ButtonStyle, ChannelType, ComponentType, Guild, GuildTextBasedChannel, If, Message, PermissionResolvable, PermissionsBitField, StageChannel, inlineCode } from 'discord.js';
import { Logger, recursiveObjectReplaceValues } from 'fallout-utility';
import { resolveFromCachedManager } from '../utils/managers.js';
import { readFileSync, rmSync, writeFileSync } from 'fs';
import { PingData, pingServer } from '../utils/ping.js';
import { ChildProcess, spawn } from 'child_process';
import { ServerManager } from './ServerManager.js';
import defaultsDeep from 'lodash.defaultsdeep';
import { PartialDeep } from 'type-fest';
import { Kirin } from '../../Kirin.js';
import { randomBytes } from 'crypto';
import { cwd } from 'reciple';
import path from 'path';

export type ServerDataWithIdStatus = ServerData & { id: string; status: ServerStatus; };

export interface ServerData {
    name: string;
    protocol: 'bedrock'|'java';
    description?: string|null;
    file?: string|null;
    channelId?: string|null;
    messageId?: string|null;
    ip: string;
    server: {
        cwd: string;
        command: string;
        jar?: string|null;
        args?: string[]|null;
        serverArgs?: string[]|null;
        killSignal?: NodeJS.Signals|null;
        killOnBotStop?: boolean|null;
    };
    messages: Record<'offline'|'online'|'starting'|'unattached', BaseMessageOptions>;
    components: Record<'start'|'stop', null|APIButtonComponentBase<ButtonStyle.Primary|ButtonStyle.Secondary|ButtonStyle.Success|ButtonStyle.Danger>>;
    permissions?: null|Record<'start'|'stop', null|PermissionResolvable>;
    ping: Record<'pingInterval'|'pingTimeout', number>;
}

export type ServerStatus = 'Online'|'Offline'|'Starting'|'Unattached';

export class Server<Ready extends boolean = boolean> {
    readonly id: string = randomBytes(16).toString('hex');
    readonly kirin: Kirin;
    readonly manager: ServerManager;
    readonly logger?: Logger;

    private _channel?: Exclude<GuildTextBasedChannel, StageChannel>|null = null;
    private _message?: Message|null = null;
    private _deleted: boolean = false;
    private _pingInterval?: NodeJS.Timer;
    private _pendingStop: boolean = false;

    get name() { return this.options.name; }
    get protocol() { return this.options.protocol; }
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
    get messages() { return this.replacePlaceholders(this.options.messages); }

    get components() {
        return {
            start: this.options.components.start
                ? new ButtonBuilder(this.replacePlaceholders(this.options.components.start)).setCustomId(`kirin-start-${this.id}`)
                : null,
            stop: this.options.components.stop
                ? new ButtonBuilder(this.replacePlaceholders(this.options.components.stop)).setCustomId(`kirin-stop-${this.id}`)
                : null
        };
    }

    get permissions() {
        return {
            start: this.options.permissions?.start ? new PermissionsBitField(this.options.permissions.start) : null,
            stop: this.options.permissions?.stop ? new PermissionsBitField(this.options.permissions.stop) : null
        };
    }

    get messageContent() {
        let content: BaseMessageOptions = { embeds: [], components: [] };

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
            case 'Unattached':
                content = this.messages.unattached;
                break;
        }

        if (!content) content = { content: `Server status: ${inlineCode(this.status)}` };

        const actionRowComponents = this.status === 'Online' ? this.components.stop?.toJSON() : this.components.start?.toJSON();

        content.components = this.status !== 'Starting' && this.status !== 'Unattached' && actionRowComponents
            ? [
                {
                    type: ComponentType.ActionRow,
                    components: [actionRowComponents]
                }
            ]
            : [];

        return content;
    }


    get status(): ServerStatus {
        if (!this.isStopped() && this.lastPing?.status === 'Online' && !this._pendingStop) return 'Online';
        if (!this.isStopped() && this.lastPing?.status === 'Offline' && !this._pendingStop) return 'Starting';
        if (this.isStopped() && this.lastPing?.status === 'Offline') return 'Offline';
        if (this.isStopped() && this.lastPing?.status === 'Online') return 'Unattached';

        return 'Offline';
    }

    get cwd () { return path.isAbsolute(this.server.cwd) ? this.server.cwd : path.join(cwd, this.server.cwd); }
    get cached() { return !!this.manager.cache.get(this.id); }
    get deleted() { return this._deleted; }

    public process?: ChildProcess;
    public lastPing?: PingData;

    constructor(public options: ServerData, kirin: Kirin) {
        this.kirin = kirin;
        this.manager = kirin.servers;
        this.logger = kirin.logger?.clone({ name: `Kirin/Server:${this.name}` })
    }

    public async start(): Promise<this> {
        if (!this.isStopped()) throw new Error('Server process is already started');

        this._pendingStop = false;

        this.logger?.warn(`Starting ${this.name}...`);
        this.logger?.debug(`Starting ${this.name}: cwd: ${this.cwd}; jar: ${this.server.jar}`);

        this.process = spawn(this.server.command, [
            ...(this.server.args ?? []),
            ...(this.server.jar ? ["-jar", this.server.jar] : []),
            ...(this.server.serverArgs ?? ['--nogui'])
        ], {
            cwd: this.cwd,
            detached: !this.server.killOnBotStop,
            killSignal: this.server.killSignal || 'SIGINT',
            env: process.env,
            // shell: true,
            stdio: []
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

        this.logger?.warn(`Stopping ${this.name} (PID: ${this.process.pid})`);

        this._pendingStop = true;

        const kill = process.kill(this.process.pid, this.server.killSignal || 'SIGINT');

        if (!kill) {
            if (this.isStopped()) {
                this.process = undefined;
                return true;
            }

            return new Promise(res => {
                const timeout = setTimeout(() => res(false), 1000 * 10);
                const handle = () => {
                    this.process = undefined;
                    this._pendingStop = false;
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

            await message.edit(this.messageContent);

            this._message = message;
        } else if (this.channelId && !this.messageId) {
            this.createMessage({ channel: this.channel! });
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

        if (deleteJsonFile && this.message) await this.message.delete().catch(() => null);

        this._deleted = true;

        if (deleteJsonFile && this.file) rmSync(this.file, { force: true, recursive: true });
    }

    public async update(options: PartialDeep<ServerData>): Promise<this> {
        const oldOptions = this.options;
        const newOptions = defaultsDeep(options, this.options) as ServerData;
        const isFetch = newOptions.channelId !== this.options.channelId
            || newOptions.messageId !== this.options.messageId
            || newOptions.ip !== this.options.ip
            || newOptions.ping.pingInterval !== this.options.ping.pingInterval
            || newOptions.ping.pingTimeout !== this.options.ping.pingTimeout;

        const isNeedsRestart = newOptions.server.args !== this.options.server.args
            || newOptions.server.command !== this.options.server.command
            || newOptions.server.cwd !== this.options.server.cwd
            || newOptions.server.jar !== this.options.server.jar;

        this.manager.emit('serverUpdate', oldOptions, this);
        this.options = newOptions;

        if (isFetch) await this.fetch();
        if (!oldOptions.messageId && newOptions.messageId && this.channel) await this.createMessage({ deleteOld: true });

        this.saveJson();

        return this;
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
            timeout: this.options.ping.pingTimeout,
            protocol: this.protocol
        });

        this.lastPing = newPing;
        this.manager.emit('serverPing', oldPing, newPing, this);
        await this.message?.edit(this.messageContent);

        return newPing;
    }

    public saveJson(file?: string|null): void {
        file = file ?? this.file;
        if (!file) throw new Error('No file path specified');
        if (!this.file) this.options.file = file;

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

    public toJSON(serverData?: true): ServerDataWithIdStatus;
    public toJSON(serverData?: false): ServerData;
    public toJSON(serverData: boolean = true): ServerData|ServerDataWithIdStatus {
        return {
            ...(serverData ? { id: this.id, status: this.status } : {}),
            ...this.options
        };
    }

    public replacePlaceholders<T extends string|object>(data: T, customPlaceholders?: Record<string, string>): T {
        return recursiveObjectReplaceValues(
            data,
            [
                '{server_id}',
                '{server_name}',
                '{server_description}',
                '{server_status}',
                ...Object.keys(customPlaceholders ?? {})
            ],
            [
                this.id,
                this.name,
                this.description || '',
                this.status,
                ...Object.values(customPlaceholders ?? {})
            ]
        );
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

    public static validateServerData(obj: PartialDeep<ServerData>, promise: boolean = false): asserts obj is ServerData {
        if (!obj || typeof obj !== 'object') return;

        if (!obj.name) throw new Error('Name is required');
        if (!obj.ip) throw new Error('Server IP is required');
        if (!obj.protocol) throw new Error('Server protocol is required');
        if (!['java', 'bedrock'].includes(obj.protocol)) throw new Error('Expected server protocol "java"|"bedrock"');

        if (!obj.server) throw new Error('Property "server" is required');
        if (!obj.server.cwd) throw new Error('Server cwd is required');
        if (!obj.server.command) throw new Error('Server command is required');
        if (obj.server.args && !Array.isArray(obj.server.args)) throw new Error('Server args is not an array');
        if (obj.server.serverArgs && !Array.isArray(obj.server.args)) throw new Error('Server args is not an array');

        if (!obj.messages) throw new Error('Property "messages" is required');

        const missingMessages = ['offline', 'online', 'starting', 'unattached'].filter(m => !obj.messages || !Object.keys(obj.messages).includes(m));
        if (missingMessages.length) throw new Error(`Missing server messages: ${missingMessages.join(' ')}`);

        if (!obj.ping) throw new Error('Property "ping" is required');
        if (!obj.ping.pingInterval) throw new Error('Server ping interval is required');
        if (!obj.ping.pingTimeout) throw new Error('Server ping timeout is required');

        return;
    }
}
