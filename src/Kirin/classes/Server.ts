import { randomUUID } from 'crypto';
import { BaseMessageOptions, ButtonBuilder, InteractionButtonComponentData, PermissionResolvable, PermissionsBitField } from 'discord.js';
import { Kirin } from '../../Kirin.js';
import { ServerManager } from './ServerManager.js';
import { readFileSync, rmSync } from 'fs';

export interface ServerData {
    name: string;
    description?: string;
    file?: string;
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

export class Server<Ready extends boolean = false> {
    readonly id: string = randomUUID();
    readonly kirin: Kirin;
    readonly manager: ServerManager;

    private _deleted: boolean = false;

    get name() { return this.options.name; }
    get description() { return this.options.description; }
    get file() { return this.options.file; }
    get server() { return this.options.server; }
    get messages() { return this.options.messages; }
    get components() { return { start: new ButtonBuilder(this.options.components.start), stop: new ButtonBuilder(this.options.components.stop) }; }
    get permissions() { return { start: new PermissionsBitField(this.options.permissions.start), stop: new PermissionsBitField(this.options.permissions.stop) }; }

    get deleted() { return this._deleted; }

    constructor(readonly options: ServerData, kirin: Kirin) {
        this.kirin = kirin;
        this.manager = kirin.servers;
    }

    public async fetch(): Promise<Server<true>> {
        return this;
    }

    public async delete(deleteJsonFile: boolean = false): Promise<void> {
        if (deleteJsonFile && this.file) rmSync(this.file, { force: true, recursive: true });
        this.manager.cache.delete(this.id);
        this._deleted = true;
    }

    public isFetched(): this is Server<true> {
        return true;
    }

    public toJSON(): ServerData & { id: string; } {
        return {
            id: this.id,
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

        if (cache) kirin.servers.cache.set(server.id, server);
        return server;
    }
}
