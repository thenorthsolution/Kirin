import { Awaitable, Collection } from 'discord.js';
import { Server, ServerStatus } from './Server.js';
import { Kirin } from '../../Kirin.js';
import { existsSync, lstatSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import { Logger } from 'fallout-utility';
import { TypedEmitter } from 'tiny-typed-emitter';
import { PingData } from '../utils/ping.js';

export interface ServerManagerEvents {
    serverCreate: (server: Server) => any;
    serverDelete: (server: Server) => any;
    serverPing: (oldPing: PingData|undefined, newPing: PingData, server: Server) => any;
    serverStatusUpdate: (oldStatus: ServerStatus, newStatus: ServerStatus, server: Server) => any;
}

export class ServerManager extends TypedEmitter<ServerManagerEvents> {
    readonly cache: Collection<string, Server<true>> = new Collection();
    readonly logger?: Logger;

    constructor(readonly kirin: Kirin) {
        super();
        this.logger = kirin.logger?.clone({ name: 'Kirin/ServerManager' });
    }

    public mountRoutes(): this {
        this.kirin.apiClient.express.get('/api/servers/:serverId?', (req, res) => {
            if (req.params.serverId) {
                const server = this.cache.get(req.params.serverId);
                if (!server) return res.status(404).send({ error: 'Server not found' });

                return res.send(server.toJSON());
            }

            res.send(this.cache.toJSON().map(s => s.toJSON()))
        });

        this.kirin.apiClient.express.delete('/api/servers/:serverId/:deleteFile?', async (req, res) => {
            const serverId = req.params.serverId;
            const deleteFile = req.params.deleteFile === 'true';
            const server = this.cache.get(serverId);

            if (!server) return res.status(404).send({ error: 'Server not found' });

            await server.delete(deleteFile);

            res.send(server.toJSON());
        });

        return this;
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
}
