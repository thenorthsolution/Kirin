import { randomUUID } from 'crypto';
import { ActionRowBuilder, BaseMessageOptions, ButtonBuilder, ChannelType, GuildTextBasedChannel, If, InteractionButtonComponentData, Message, MessageActionRowComponentBuilder, PermissionResolvable, PermissionsBitField, StageChannel, TextBasedChannel } from 'discord.js';
import { Kirin } from '../../Kirin.js';
import { ServerManager } from './ServerManager.js';
import { readFileSync, rmSync, writeFileSync } from 'fs';
import { ChildProcess, spawn } from 'child_process';
import { PingData, pingServer } from '../utils/ping.js';
import { resolveFromCachedManager } from '../utils/managers.js';

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

    private _channel?: Exclude<GuildTextBasedChannel, StageChannel>|null = null;
    private _message?: Message|null = null;
    private _deleted: boolean = false;

    get name() { return this.options.name; }
    get description() { return this.options.description; }
    get channelId() { return this.options.channelId; }
    get channel() { return this._channel as If<Ready, Exclude<GuildTextBasedChannel, StageChannel>|undefined>; }
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

    get cached() { return !!this.manager.cache.get(this.id); }
    get deleted() { return this._deleted; }

    public pingInterval?: NodeJS.Timer;
    public process?: ChildProcess;
    public lastPing?: PingData;

    constructor(readonly options: ServerData, kirin: Kirin) {
        this.kirin = kirin;
        this.manager = kirin.servers;
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

        this.setPingInterval();

        return this as Server<true>;
    }

    public async delete(deleteJsonFile: boolean = false): Promise<void> {
        if (deleteJsonFile && this.file) rmSync(this.file, { force: true, recursive: true });
        this.manager.emit('serverDelete', this as Server);
        this.manager.cache.delete(this.id);
        this._deleted = true;
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

    public setPingInterval(interval?: number) {
        if (this.pingInterval) clearInterval(this.pingInterval);

        this.pingInterval = setInterval(async () => {
            const oldPing = this.lastPing;
            const newPing = await pingServer({
                host: this.host,
                port: this.port,
                timeout: this.options.ping.pingTimeout
            });

            this.manager.emit('serverPing', oldPing, newPing, this);
            this.lastPing = newPing;
        }, interval ?? this.options.ping.pingInterval);
    }

    public toJSON(withoutId?: false): ServerData & { id: string; };
    public toJSON(withoutId?: true): ServerData;
    public toJSON(withoutId: boolean = false): ServerData & { id?: string; } {
        return {
            ...(withoutId ? {} : { id: this.id }),
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
}
