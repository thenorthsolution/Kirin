import { Server as SocketServer } from 'socket.io';
import { Kirin } from '../../Kirin.js';
import express, { Express, Request, Response } from 'express';
import { Server as HttpServer } from 'http';
import { Awaitable, If } from 'discord.js';
import { Logger } from 'fallout-utility';
import { recursiveDefaults } from 'reciple';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync, lstatSync, mkdirSync, readdirSync } from 'fs';
import bodyParser from 'body-parser';
import cors from 'cors';
import { RequestHandler, RequestHandlerOptions } from './RequestHandler.js';
import { SocketEvents } from '../types/SocketEvents.js';

export class APIClient<Ready extends boolean = boolean> {
    private _express: Express = express();
    private _socket: SocketServer<SocketEvents>|null = null;
    private _http: HttpServer|null = null;

    get express() { return this._express; }
    get socket() { return this._socket as If<Ready, SocketServer<SocketEvents>> }
    get http() { return this._http as If<Ready, HttpServer>; }

    get password() { return this.kirin.config.api.password || null; }

    readonly logger?: Logger;
    readonly apiPath: string = '/api';
    readonly routesDir: string = path.join(path.dirname(fileURLToPath(import.meta.url)), '../routes');

    constructor(readonly kirin: Kirin) {
        this.logger = kirin.logger?.clone({ name: 'Kirin/API' });
    }

    public async start(): Promise<APIClient<true>> {
        if (this.isReady()) throw new Error('This client is already started');

        this._express.use(bodyParser.urlencoded({ extended: false }));
        this._express.use(bodyParser.json());
        this._express.use(cors({ origin: "*" }));

        await this.loadRoutes();

        await new Promise(res => {
            this._http = this._express?.listen(this.kirin.config.api.port, () => res(this._http)) || null;
        });

        this._socket = new SocketServer({ transports: ["websocket"], cors: { origin: "*" } });
        this._socket?.listen(this._http!);

        this._socket.use((socket, next) => {
            if (this.kirin.config.api.password === null) return next();
            if (this.kirin.config.api.password === socket.handshake.auth.Authorization) return next();

            return next(new Error('Invalid Authentication'));
        });

        this._socket.sockets.on('connection', socket => {
            this.logger?.debug(`Socket connected: ${socket.id}`);

            socket.once('disconnect', () => this.logger?.debug(`Socket disconnected: ${socket.id}`));
        });

        if (!this.isReady()) throw new Error('Unable to create API client');
        return this;
    }

    public async loadRoutes(): Promise<void> {
        if (!existsSync(this.routesDir)) mkdirSync(this.routesDir);

        const files = readdirSync(this.routesDir).map(f => path.join(this.routesDir, f)).filter(f => f.endsWith('.js') && lstatSync(f).isFile());

        for (const file of files) {
            try {
                const router = recursiveDefaults<(api: APIClient) => Awaitable<void>>(await import((path.isAbsolute(file) ? 'file://' : '') + file));
                if (!router) throw new Error(`Invalid API route file.`);

                await router(this);
            } catch (err) {
                this.logger?.error(`Unable to load API route from ${file}:\n`, err);
            }
        }
    }

    public createRequestHandler(request: Request, response: Response, options?: RequestHandlerOptions): RequestHandler {
        return new RequestHandler(request, response, this, options);
    }

    public isReady(): this is APIClient<true> {
        return this._express !== null && this._http !== null && this.socket !== null;
    }
}
