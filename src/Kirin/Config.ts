import { createConfig } from '../_createConfig';
import path from 'path';
import yml from 'yaml';
import { ServerOptions } from './Server';
import { PermissionString } from 'discord.js';

export interface KirinConfig {
    permissions: {
        start: {
            allowedPermissions: PermissionString[];
            allowedRoles: string[];
        };
        stop: {
            allowedPermissions: PermissionString[];
            allowedRoles: string[];
        },
        init: {
            allowedPermissions: PermissionString[];
        }
    };
    process: {
        initServerMessageCommant: boolean;
        controlViaCommands: boolean;
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
            permissions: {
                start: {
                    allowedPermissions: [],
                    allowedRoles: ['000000000000000000']
                },
                stop: {
                    allowedPermissions: ['ADMINISTRATOR'],
                    allowedRoles: ['000000000000000000']
                },
                init: {
                    allowedPermissions: ['MANAGE_MESSAGES']
                }
            },
            process: {
                initServerMessageCommant: true,
                controlViaCommands: true,
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
                embedVersionValue: '{0}',
                unknownAction: 'Unknown interaction',
                startDescription: 'Start a server',
                stopDescription: 'Stop a server',
                alreadyStarted: 'Server is already running',
                alreadyStopped: 'Server is already stopped',
                failedToStop: 'Failed to stop server',
                serverNotFound: 'Server not found',
                starting: 'Starting...',
                stopping: 'Stopping...'
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
