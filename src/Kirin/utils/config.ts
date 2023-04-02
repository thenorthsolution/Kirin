import { PermissionResolvable } from 'discord.js';
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
    };
    command: {
        enabled: boolean;
        allowInDM: boolean;
        ephemeralReplies: boolean;
        requiredPermissions: PermissionResolvable;
    };
}

export const defaultConfig: Config = {
    serversFolders: 'config/servers/',
    api: {
        enabled: false,
        port: 55667,
        password: null
    },
    command: {
        enabled: true,
        allowInDM: false,
        ephemeralReplies: false,
        requiredPermissions: ['SendMessages']
    }
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
