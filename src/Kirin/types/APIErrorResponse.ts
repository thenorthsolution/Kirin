export type APIErrorResponse = APIInvalidAuthResponse|APIServerNotFoundResponse|APIServerActionFailedResponse;

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
