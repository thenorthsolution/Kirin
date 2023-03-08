import { ServerStatus } from '../classes/Server.js';
import McProtocol, { NewPingResult } from 'minecraft-protocol';

const { ping } = McProtocol;

export interface PingData {
    status: Exclude<ServerStatus, 'Starting'|'Stopping'>;
    maxPlayers: null|number;
    onlinePlayers: null|number;
    version: null|string;
    latency: null|number;
    pingedAt: Date;
}

export interface PingOptions {
    host: string;
    port?: number;
    timeout?: number;
}

export async function pingServer(options: PingOptions): Promise<PingData> {
    const pingData = await ping({
        host: options.host,
        port: options.port,
        closeTimeout: options.timeout
    }).catch(() => null);

    let status: PingData = {
        status: 'Offline',
        maxPlayers: 0,
        onlinePlayers: 0,
        version: null,
        latency: null,
        pingedAt: new Date()
    };

    if (!pingData) return status;
    if (typeof (pingData as NewPingResult).players === 'undefined') return status;

    const newPingResult = pingData as NewPingResult;

    status.status = 'Online';
    status.maxPlayers = newPingResult.players.max;
    status.onlinePlayers = newPingResult.players.online;
    status.latency = newPingResult.latency;
    status.version = newPingResult.version.name;

    return status;
}
