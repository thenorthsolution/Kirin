import { Server as SocketServer } from 'socket.io';
import { Kirin } from '../../Kirin.js';
import express, { Express } from 'express';
import { Server as HttpServer } from 'http';
import { If } from 'discord.js';
import { Logger } from 'fallout-utility';
import { recursiveDefaults } from 'reciple';

export class APIClient<Ready extends boolean = false> {
    private _express: Express = express();
    private _socket: SocketServer|null = null;
    private _http: HttpServer|null = null;

    get express() { return this._express; }
    get socket() { return this._socket as If<Ready, SocketServer> }
    get http() { return this._http as If<Ready, HttpServer>; }

    readonly logger?: Logger;

    constructor(readonly kirin: Kirin) {
        this.logger = kirin.logger?.clone({ name: 'Kirin/API' });
    }

    public async start(): Promise<APIClient<true>> {
        if (this.isReady()) throw new Error('This client is already started');

        const dashboard = recursiveDefaults<any>(await import(('../../../dashboard/build/handler.js')));

        this._express.use(dashboard.handler);

        await new Promise(res => {
            this._http = this._express?.listen(this.kirin.config.apiPort, () => res(this._http)) || null;
        });

        this._socket = new SocketServer({ transports: ["websocket"] });
        this._socket?.listen(this._http!);

        if (!this.isReady()) throw new Error('Unable to create API client');
        return this;
    }

    public isReady(): this is APIClient<true> {
        return this._express !== null && this._http !== null && this.socket !== null;
    }
}
