import { ServerData, ServerDataWithIdStatus } from '../classes/Server.js';

export type APIResponse = APIPingResponse|APIAuthorizeResponse|APIServerResponse|APIServersResponse|APIServerRconResponse;

export interface APIPingResponse {
    type: 'Ping';
    message: string|null;
}

export interface APIAuthorizeResponse {
    type: 'Authorize';
    authorized: boolean;
}

export interface APIServerResponse<WithIdStatus extends boolean = true> {
    type: 'ServerCreate'|'ServerUpdate'|'ServerDelete'|'Server'|'ServerStarting'|'ServerStopping';
    server: WithIdStatus extends true ? ServerDataWithIdStatus : ServerData;
}

export interface APIServersResponse<WithIdStatus extends boolean = true> {
    type: 'Servers';
    servers: (WithIdStatus extends true ? ServerDataWithIdStatus : ServerData)[];
}

export interface APIServerRconResponse {
    type: 'ServerRconResponse';
    rconResponse: string;
}
