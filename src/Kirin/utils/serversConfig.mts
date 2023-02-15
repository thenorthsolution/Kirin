import { createReadFile, path } from 'fallout-utility';
import { KirinConfig, defaultKirinConfig } from './config.mjs';
import { cwd } from 'reciple';
import yml from 'yaml';

export type DoNothing<T> = T;

export interface BaseServerConfig {
    name: string;
    description?: string|null;
    connection?: {
        host?: string;
        port?: number;
    };
    server: {
        cwd: string;
        serverExecutable: string;
        args: string[];
    };
    permissions?: Partial<KirinConfig['defaults']['permissions']>|null;
    killSignal?: KirinConfig['defaults']['killSignal']|null;
    debug?: boolean|null;
    showStatus?: boolean;
    [key: string]: any;
}

export const defaultServerConfig = {
    name: 'Server Name',
    description: 'My amazing server',
    hideDisabledButtons: true,
    connection: {
        host: 'localhost',
        port: 25565
    },
    message: {
        channelId: '',
        messageId: ''
    },
    server: {
        cwd: '',
        serverExecutable: '',
        args: []
    },
    permissions: defaultKirinConfig.defaults.permissions,
    killSignal: defaultKirinConfig.defaults.killSignal,
    showStatusDetails: true,
    debug: false
} satisfies BaseServerConfig;

export type ServerConfig = typeof defaultServerConfig & BaseServerConfig;

export interface ServersConfig {
    servers: ServerConfig[];
}

export function createServersConfig(): ServerConfig[] {
    const location = path.join(cwd, 'config/Kirin/servers.yml');

    return createReadFile(location, { servers: [] }, {
        encodeFileData: (data) => {
            const instructions = [''];

            const fileData = yml.stringify(data);

            return instructions.join('\n') + '\n\n' + fileData;
        },
        formatReadData: (data) => yml.parse(data.toString('utf-8')),
        encoding: 'utf-8'
    }).servers;
}
