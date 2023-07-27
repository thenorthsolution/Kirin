import JavaProtocol, { NewPingResult } from 'minecraft-protocol';
import { ServerStatus } from '../classes/Server.js';
import BedrockProtocol from 'bedrock-protocol';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import { parseBase64URL } from './parseBase64URL.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PingData {
    status: Exclude<ServerStatus, 'Starting'|'Stopping'>;
    maxPlayers: number;
    onlinePlayers: number;
    version: null|string;
    latency: null|number;
    motd: null|string;
    favicon: null|Buffer;
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

export async function pingServer(options: (JavaPingOptions|BedrockPingOptions) & { useWorkerThread?: boolean; }): Promise<PingData> {
    if (options.useWorkerThread === false) {
        return options.protocol === 'java' ? await pingJavaServer(options) : await pingBedrockServer(options);
    }

    const data: PingData = await new Promise((res, rej) => {
        const worker = new Worker(path.join(__dirname, './workers/ping.js'), {
            workerData: options
        });

        worker.on('message', res);
        worker.on('error', rej);
        worker.on('exit', code => {
            if (code !== 0) rej(new Error(`Ping worker exited with an error code: ${code}`));
        });
    });

    data.favicon = data.favicon !== null
        ? data.favicon instanceof Buffer ? data.favicon : Buffer.from(data.favicon)
        : null;

    return data;
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
        motd: null,
        favicon: null,
        pingedAt: new Date()
    };

    if (!pingData) return status;
    if (typeof (pingData as NewPingResult).players === 'undefined') return status;

    const newPingResult = pingData as NewPingResult;

    status.status = 'Online';
    status.maxPlayers = newPingResult.players.max;
    status.onlinePlayers = newPingResult.players.online;
    status.latency = newPingResult.latency;
    status.motd = (typeof newPingResult.description === 'string' ? newPingResult.description : newPingResult.description.text)?.replace(/§[0-9A-FK-OR]/gi, '') || null;
    status.favicon = newPingResult.favicon ? parseBase64URL(newPingResult.favicon) : null;
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
        motd: null,
        favicon: null,
        pingedAt: new Date()
    };

    if (!pingData) return status;

    status.status = 'Online';
    status.maxPlayers = pingData.playersMax;
    status.onlinePlayers = pingData.playersOnline;
    status.latency = null;
    status.motd = pingData.motd?.replace(/§[0-9A-FK-OR]/gi, '') || null
    status.version = pingData.version;

    return status;
}
