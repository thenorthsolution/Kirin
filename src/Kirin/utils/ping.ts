import { ServerStatus } from '../classes/Server.js';
import JavaProtocol, { NewPingResult } from 'minecraft-protocol';
import BedrockProtocol from 'bedrock-protocol';

export interface PingData {
    status: Exclude<ServerStatus, 'Starting'|'Stopping'>;
    maxPlayers: null|number;
    onlinePlayers: null|number;
    version: null|string;
    latency: null|number;
    pingedAt: Date;
}

export interface PingOptions {
    protocol: 'bedrock'|'java';
    host: string;
    port?: number;
    timeout?: number;
}

export type JavaPingOptions = Omit<PingOptions, 'protocol'> & { protocol: 'java' };
export type BedrockPingOptions = Omit<PingOptions, 'protocol' | 'timeout'> & { protocol: 'bedrock' };

export async function pingServer(options: JavaPingOptions|BedrockPingOptions): Promise<PingData> {
    return options.protocol === 'java' ? pingJavaServer(options) : pingBedrockServer(options);
}

export async function pingJavaServer(options: JavaPingOptions): Promise<PingData> {
    const pingData = await JavaProtocol.ping({
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

export async function pingBedrockServer(options: BedrockPingOptions): Promise<PingData> {
    const pingData = await BedrockProtocol.ping({
        host: options.host,
        port: options.port || 19132
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

    status.status = 'Online';
    status.maxPlayers = pingData.playersMax;
    status.onlinePlayers = pingData.playersOnline;
    status.latency = null;
    status.version = pingData.version;

    return status;
}
