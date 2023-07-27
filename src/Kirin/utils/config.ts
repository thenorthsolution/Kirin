import { PermissionResolvable, inlineCode, mergeDefault } from 'discord.js';
import { CorsOptions, CorsOptionsDelegate } from 'cors';
import { createReadFile } from 'fallout-utility';
import { writeFileSync } from 'fs';
import { cli } from 'reciple';
import path from 'path';

export interface Config {
    serversFolders: string;
    api: {
        enabled: boolean;
        port: number;
        password: string|null;
        cors: CorsOptions|CorsOptionsDelegate;
    };
    command: {
        enabled: boolean;
        ephemeralReplies: boolean;
        requiredPermissions: PermissionResolvable;
    };
    messages: typeof messages;
}

export const messages = {
    serverNotFound: `Couldn\'t find server id ${inlineCode('{server_id}')}`,
    serverAlreadyStarted: `This server is already starting`,
    serverStarting: `Server is starting...`,
    noStartPermissions: `You don't have permissions to start this server`,
    serverAlreadyStopped: `This server is not started`,
    serverStopping: `Server is stopping...`,
    noStopPermissions: `You don't have permissions to stop this server`,
    serverIsOffline: `Server is offline`,
    serverDeleted: `Server has been deleted`,
    serverIsOnline: `Stop the server to continue`,
    serverIsUnattached: `Server process is currently not accessible by the bot`,
    serverRconNotConnected: `Rcon is not connected in this server`
};

export const defaultConfig: Config = {
    serversFolders: 'config/servers/',
    api: {
        enabled: false,
        port: 55667,
        password: null,
        cors: { origin: '*' }
    },
    command: {
        enabled: true,
        ephemeralReplies: false,
        requiredPermissions: ['SendMessages']
    },
    messages: messages
};

export function getConfig(): Config {
    return createReadFile(path.join(cli.cwd, 'config/config.json'), defaultConfig, {
        encodeFileData: data => JSON.stringify(data, null, 2),
        formatReadData: data => {
            const config = mergeDefault(JSON.parse(data.toString('utf-8')), defaultConfig) as Config;

            writeFileSync(path.join(cli.cwd, 'config/config.json'), JSON.stringify(config, null, 2));

            return config;
        },
        encoding: 'utf-8'
    })
}
