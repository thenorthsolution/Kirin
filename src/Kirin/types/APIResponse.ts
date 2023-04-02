import { ServerData, ServerStatus } from '../classes/Server.js';

export type APIResponse = APIPingResponse|APIServerResponse|APIServersResponse;

export interface APIPingResponse {
    type: 'Ping';
    message: string|null;
}

export interface APIServerResponse<WithIdStatus extends boolean = true> {
    type: 'ServerCreate'|'ServerUpdate'|'ServerDelete'|'Server';
    server: WithIdStatus extends true ? ServerData & { id: string; status: ServerStatus; } : ServerData;
}

export interface APIServersResponse<WithIdStatus extends boolean = true> {
    type: 'Servers';
    servers: (WithIdStatus extends true ? ServerData & { id: string; status: ServerStatus; } : ServerData)[];
}
