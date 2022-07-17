import { createConfig } from '../_createConfig';
import path from 'path';
import yml from 'yaml';
import { ServerOptions } from './Server';

export interface KirinConfig {
    process: {
        stopServersOnExit: boolean;
        showConsoleMessages: boolean;
    };
    ping: {
        pingIntervalMs: number;
        pingTimeoutMs: number;
        showPingErrorMessages: boolean;
        displayServerStatus: boolean;
        zeroMaxServersAsOffline: boolean;
    };
    miscellaneous: {
        deleteDisabledButtons: boolean;
        disableAllButtons: boolean;
    };
    messages: {
        [message_key: string]: string;
    }
}
export interface KirinServerlist {
    servers: Omit<ServerOptions, "kirin">[];
}

export class Config {
    public static getConfig(): KirinConfig {
        const configPath = path.join(process.cwd(), 'config/kirin/config.yml');
        const defaultConfig: KirinConfig = {
            process: {
                showConsoleMessages: true,
                stopServersOnExit: false
            },
            ping: {
                pingIntervalMs: 5000,
                pingTimeoutMs: 5000,
                displayServerStatus: true,
                showPingErrorMessages: false,
                zeroMaxServersAsOffline: true
            },
            miscellaneous: {
                deleteDisabledButtons: true,
                disableAllButtons: false
            },
            messages: {
                startButtonLabel: 'Start',
                stopButtonLabel: 'Stop',
                onlineEmbedColor: 'BLUE',
                offlineEmbedColor: 'DARK_BUT_NOT_BLACK',
                embedStatusLabel: 'Status',
                embedStatusOnline: '**Online**',
                embedStatusOffline: '**Offline**',
                embedPlayersLabel: 'Online Players',
                embedPlayersList: '{0}/{1}',
                embedVersionLabel: 'Server Version',
                embedVersionValue: '{0}'
            }
        };

        return yml.parse(createConfig(configPath, defaultConfig));
    }

    public static getServers(): KirinServerlist {
        const configPath = path.join(process.cwd(), 'config/kirin/servers.yml');
        const defaultServerlist: KirinServerlist = {
            servers: [
                {
                    id: "test-server",
                    host: "localhost",
                    port: 25565,
                    server_root: "./path-to-server-root-directory",
                    start_script: "java -jar server.jar",
                    stop_signal: "SIGINT",
                    channel_id: "000000000000000000",
                    message_id: "000000000000000000",
                    description: "Some description",
                    name: "Test Server"
                }
            ]
        };

        return yml.parse(createConfig(configPath, defaultServerlist));
    }
}
