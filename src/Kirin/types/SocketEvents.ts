import { ServerData, ServerDataWithIdStatus, ServerStatus } from '../classes/Server.js';
import { PingData } from '../utils/ping.js';

export interface SocketEvents {
    serverCreate: (server: ServerDataWithIdStatus) => any;
    serverDelete: (server: ServerDataWithIdStatus) => any;
    serverUpdate: (oldState: ServerData, newState: ServerDataWithIdStatus) => any;
    serverStart: (server: ServerDataWithIdStatus) => any;
    serverStop: (server: ServerDataWithIdStatus) => any;
    serverProcessStart: (pid: number, server: ServerDataWithIdStatus) => any;
    serverProcessStop: (pid: number, server: ServerDataWithIdStatus) => any;
    serverProcessError: (error: string, server: ServerDataWithIdStatus) => any;
    serverProcessStdout: (message: string, server: ServerDataWithIdStatus) => any;
    serverProcessStderr: (message: string, server: ServerDataWithIdStatus) => any;
    serverPing: (oldPing: PingData|null, newPing: PingData, server: ServerDataWithIdStatus) => any;
    serverStatusUpdate: (oldStatus: ServerStatus, newStatus: ServerStatus, server: ServerDataWithIdStatus) => any;
    serverRconConnect: (server: ServerDataWithIdStatus) => any;
    serverRconDisconnect: (server: ServerDataWithIdStatus) => any;
    serverRconError: (error: string, server: ServerDataWithIdStatus) => any;
}
