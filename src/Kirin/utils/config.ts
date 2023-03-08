import { createReadFile } from 'fallout-utility';
import { writeFileSync } from 'fs';
import defaultsDeep from 'lodash.defaultsdeep';
import path from 'path';
import { cwd } from 'reciple';

export interface Config {
    apiPort: number;
    serversFolders: string;
    password: string|null;
}

export const defaultConfig: Config = {
    apiPort: 55667,
    serversFolders: 'config/servers/',
    password: null
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
