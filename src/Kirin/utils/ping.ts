import { ServerStatus } from '../classes/Server.js';

export interface PingData {
    status: Exclude<ServerStatus, 'Starting'|'Stopping'>;
    maxPlayers: null|number;
    onlinePlayers: null|number;
    version: null|string;
    latency: null|number;
    pingedAt: Date;
}
