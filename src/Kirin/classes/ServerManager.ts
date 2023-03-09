import { Awaitable, Channel, Collection, Guild, Message } from 'discord.js';
import { Server, ServerStatus } from './Server.js';
import { Kirin } from '../../Kirin.js';
import { existsSync, lstatSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import { Logger } from 'fallout-utility';
import { TypedEmitter } from 'tiny-typed-emitter';
import { PingData } from '../utils/ping.js';
import { ChildProcess } from 'child_process';

export interface ServerManagerEvents {
    serverCreate: (server: Server) => any;
    serverDelete: (server: Server) => any;
    serverStart: (server: Server) => any;
    serverStop: (server: Server) => any;
    serverProcessStart: (childProcess: ChildProcess, server: Server) => any;
    serverProcessStop: (childProcess: ChildProcess, server: Server) => any;
    serverProcessError: (error: Error, server: Server) => any;
    serverProcessStdout: (message: string, server: Server) => any;
    serverProcessStderr: (message: string, server: Server) => any;
    serverPing: (oldPing: PingData|undefined, newPing: PingData, server: Server) => any;
    serverStatusUpdate: (oldStatus: ServerStatus, newStatus: ServerStatus, server: Server) => any;
}

export class ServerManager extends TypedEmitter<ServerManagerEvents> {
    readonly cache: Collection<string, Server<true>> = new Collection();
    readonly logger?: Logger;

    constructor(readonly kirin: Kirin) {
        super();
        this.logger = kirin.logger?.clone({ name: 'Kirin/ServerManager' });

        this._onGuildDelete = this._onGuildDelete.bind(this);
        this._onChannelDelete = this._onChannelDelete.bind(this);
        this._onMessageDelete = this._onMessageDelete.bind(this);

        this.kirin.client.on('guildDelete', this._onGuildDelete);
        this.kirin.client.on('channelDelete', this._onChannelDelete);
        this.kirin.client.on('messageDelete', this._onMessageDelete);

        this.on('serverPing', (oP, nP, srv) => srv.logger?.debug(`STATUS: ${srv.status}`));
        this.on('serverProcessStdout', (msg, srv) => srv.logger?.log(msg));
        this.on('serverProcessStderr', (msg, srv) => srv.logger?.err(msg));
    }

    public async loadServersFromDir(dir: string, cache: boolean = true): Promise<Server[]> {
        dir = path.resolve(dir);

        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

        const files = readdirSync(dir).map(f => path.join(dir, f)).filter(f => lstatSync(f).isFile());
        const loaded: Server[] = [];

        for (const file of files) {
            try {
                const server = await Server.from(file, this.kirin, cache);
                loaded.push(server);
            } catch (err) {
                this.logger?.error(`Failed to load server file from '${file}':\n`, err);
            }
        }

        return loaded;
    }

    public unmountClientListeners(): void {
        this.kirin.client.removeListener('guildDelete', this._onGuildDelete);
        this.kirin.client.removeListener('channelDelete', this._onChannelDelete);
        this.kirin.client.removeListener('messageDelete', this._onMessageDelete);
    }

    private async _onGuildDelete(guild: Guild): Promise<void> {
        const servers = this.cache.filter(s => s.guild?.id === guild.id);

        for (const server of (servers?.toJSON() || [])) {
            await server.delete(false);
        }
    }

    private async _onChannelDelete(channel: Channel): Promise<void> {
        const servers = this.cache.filter(s => s.channel?.id === channel.id);

        for (const server of (servers?.toJSON() || [])) {
            await server.delete(false);
        }
    }

    private async _onMessageDelete(message: Message): Promise<void> {
        const servers = this.cache.filter(s => s.message?.id === message.id);

        for (const server of (servers?.toJSON() || [])) {
            await server.delete(false);
        }
    }
}
