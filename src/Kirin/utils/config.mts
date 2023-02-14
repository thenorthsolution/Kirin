import { PermissionResolvable } from 'discord.js';
import { createReadFile, path } from 'fallout-utility';
import { cwd } from 'reciple';
import yml from 'yaml';

export interface BaseKirinConfig {
    defaults: {
        hideDisabledButtons: boolean;
        permissions: {
            start: {
                allowedPermissions: PermissionResolvable;
                allowedRoles: string[];
            },
            stop: BaseKirinConfig['defaults']['permissions']['start'];
        };
    };
    [key: string]: any;
};

export const defaultKirinConfig = {
    defaults: {
        permissions: {
            start: {
                allowedPermissions: [],
                allowedRoles: []
            },
            stop: {
                allowedPermissions: [],
                allowedRoles: []
            }
        },
        hideDisabledButtons: true
    },
    ping: {
        pingIntervalMs: 10000,
        pingTimeoutMs: 10000,
        debug: false
    }
} satisfies BaseKirinConfig;

export type KirinConfig = typeof defaultKirinConfig & BaseKirinConfig;

export function createConfig(): KirinConfig {
    const location = path.join(cwd, 'config/Kirin/config.yml');

    return createReadFile(location, defaultKirinConfig, {
        encodeFileData: (data) => yml.stringify(data),
        formatReadData: (data) => yml.parse(data.toString('utf-8')),
        encoding: 'utf-8'
    });
}


