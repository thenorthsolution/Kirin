import { ServerData, ServerDataWithIdStatus } from '../classes/Server.js';

export type APIErrorResponse = APIInvalidAuthResponse|APIServerNotFoundResponse|APIServerActionFailedResponse|APIServerStopFailedResponse;

export interface APIInvalidAuthResponse {
    error: 'InvalidAuth';
}

export interface APIServerNotFoundResponse {
    error: 'ServerNotFound';
    id: string|null;
}

export interface APIServerActionFailedResponse {
    error: 'ServerCreateFailed'|'ServerUpdateFailed';
    message: string;
}

export interface APIServerStopFailedResponse {
    error: 'ServerStopFailed';
    server: ServerDataWithIdStatus;
}
