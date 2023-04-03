import { Request, Response } from 'express';
import { APIClient } from './APIClient.js';
import { APIErrorResponse } from '../types/APIErrorResponse.js';
import { Awaitable } from 'discord.js';
import { APIResponse } from '../types/APIResponse.js';

export interface RequestHandlerOptions {
    authorize?: boolean;
}

export class RequestHandler {
    constructor(readonly request: Request, readonly response: Response, readonly apiClient: APIClient, readonly options?: RequestHandlerOptions) {}

    public authorize(): boolean {
        if (this.isAuthorized()) return true;

        this.sendAPIErrorResponse(401, { error: 'InvalidAuth' });
        return false;
    }

    public sendAPIErrorResponse<T extends APIErrorResponse>(code: number, message?: T) {
        return this.response.status(code).send(message);
    }

    public sendAPIResponse<T extends APIResponse>(message: T, code?: number) {
        if (typeof code === 'number') this.response.status(code);
        return this.response.send(message);
    }

    public async handle(handler: (requestHandler: this) => Awaitable<any>): Promise<void> {
        if (this.options?.authorize !== false && !this.authorize()) return;

        await Promise.resolve(handler(this));
    }

    public isAuthorized(): boolean {
        return this.apiClient.password === null || this.request.get('Authorization') === this.apiClient.password
    }
}
