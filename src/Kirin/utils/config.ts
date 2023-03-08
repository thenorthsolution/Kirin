import { createReadFile } from 'fallout-utility';
import path from 'path';
import { cwd } from 'reciple';

export interface Config {
    apiPort: number;
    serversFolders: string;
}

export const defaultConfig: Config = {
    apiPort: 55667,
    serversFolders: 'config/servers/'
};

export function getConfig(): Config {
    return createReadFile(path.join(cwd, 'config/config.json'), defaultConfig, {
        encodeFileData: data => JSON.stringify(data, null, 2),
        formatReadData: data => JSON.parse(data.toString('utf-8')),
        encoding: 'utf-8'
    })
}
