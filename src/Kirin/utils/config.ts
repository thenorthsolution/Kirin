import { CorsOptions, CorsOptionsDelegate } from 'cors';
import { BaseMessageOptions, PermissionResolvable, inlineCode } from 'discord.js';
import { createReadFile } from 'fallout-utility';
import { writeFileSync } from 'fs';
import defaultsDeep from 'lodash.defaultsdeep';
import path from 'path';
import { cwd } from 'reciple';

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
    serverIsOnline: `Stop the server to continue`
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
    return createReadFile(path.join(cwd, 'config/config.json'), defaultConfig, {
        encodeFileData: data => JSON.stringify(data, null, 2),
        formatReadData: data => {
            const config: Config = defaultsDeep(JSON.parse(data.toString('utf-8')), defaultConfig);

            writeFileSync(path.join(cwd, 'config/config.json'), JSON.stringify(config, null, 2));

            return config;
        },
        encoding: 'utf-8'
    })
}
