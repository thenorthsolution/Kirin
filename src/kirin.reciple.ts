import { RecipleClient, RecipleScript } from 'reciple';
import { replaceAll } from 'fallout-utility';
import discord from 'discord.js';
import path from 'path';
import yml from 'yaml';
import fs from 'fs';
import { KirinServer, KirinServerOptions } from './Kirin/Server';

export interface KirinServerActionConfig {
    enabled?: boolean;
    addButton?: boolean;
    allowedPermissions?: discord.PermissionString[];
    allowedRoles?: discord.RoleResolvable[];
}

export interface KirinServerPingConfig {
    pingIntervalMs?: number;
    pingTimeoutMs?: number;
    zeroMaxMeansOffline?: boolean;
}

export interface KirinServerConfig {
    printToConsole?: boolean;
    displayPingErrors?: boolean;
    stopServerOnExit?: boolean;
    stopSignal?: NodeJS.Signals;
    useMenu?: boolean;
    start?: KirinServerActionConfig;
    stop?: KirinServerActionConfig;
    restart?: KirinServerActionConfig;
    pingOptions?: KirinServerPingConfig;
}

export interface KirinConfig {
    defaultServerConfig: KirinServerConfig;
    onlineServersLimit: number;
    deleteDisabledButtons: boolean;
    messages: {
        [key: string]: string;
    }
}

export class KirinModule implements RecipleScript {
    public versions = ['1.1.0','1.1.1','1.1.2','1.1.3','1.1.4'];
    public config = KirinModule.getConfig();
    public client!: RecipleClient;
    public servers: KirinServer[] = [];

    public onStart(client: RecipleClient) {
        this.client = client;
        return true;
    }

    public async onLoad() {
        await this.parseServers();

        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isButton() && !interaction.isSelectMenu()) return;
            if (interaction.isButton() && !interaction.customId.startsWith('kirin-server')) return;
            if (interaction.isSelectMenu() && !interaction.customId.startsWith('kirin-server-menu')) return;
            if (!interaction.deferred) await interaction.deferUpdate().catch(err => this.client.logger.error(err));

            const serverId = interaction.customId.split('-')[3];
            if (!serverId || !this.servers.some(s => s.id)) return;

            const server = this.servers.find(s => s.id === serverId);
            if (!server) return;

            let action = interaction.customId.split('-')[4];
                action = action == 'menu' && interaction.isSelectMenu() ? interaction.values[0] : action;

            await interaction.deferUpdate().catch(err => this.client.logger.error(err));

            switch (action) {
                case 'start':
                    server.start();

                    interaction.editReply(this.getMessage('starting', server.config.displayName)).catch(err => this.client.logger.error(err));
                    break;
                case 'stop':
                    server.stop();

                    interaction.editReply(this.getMessage('stopping', server.config.displayName)).catch(err => this.client.logger.error(err));
                    break;
                case 'restart':
                    // server.restart();

                    interaction.editReply(this.getMessage('restarting', server.config.displayName)).catch(err => this.client.logger.error(err));
                    break;
            }
        });
    }

    public async parseServers() {
        const rawServers = KirinModule.getServers();

        this.client.logger.info(`Parsing ${rawServers.length} servers...`);
        for (const rawServer of rawServers) {
            try {
                const server = new KirinServer({
                        ...this.config.defaultServerConfig,
                        ...rawServer
                    }, this);

                server.init();
                this.servers.push(server);
                this.client.logger.debug(`Server ${server.config.displayName} loaded successfully.`);
            } catch (err) {
                this.client.logger.error(err);
            }
        }

        this.client.logger.info(`Parsed ${this.servers.length} servers.`);
    }

    public getMessage(key: string, ...placeholders: (string|number)[]): string {
        let message = this.config.messages[key] ?? `${key}`;
        
        let i = 0;
        for (const placeholder of placeholders) {
            message = replaceAll(message, `{${i}}`, `${placeholder}`);
            i++;
        }

        return message;
    }

    public static getServers(): KirinServerOptions[] {
        const serversPath = path.join(process.cwd(), 'config/Kirin/servers.yml');
        const defaultServers: KirinServerOptions[] = [];

        if (!fs.existsSync(serversPath)) {
            fs.writeFileSync(serversPath, yml.stringify(defaultServers));
            return defaultServers;
        }

        return yml.parse(fs.readFileSync(serversPath, 'utf8')) as KirinServerOptions[];
    }

    public static getConfig(): KirinConfig {
        const defaultConfig = this.getDefaultConfig();
        const configPath = path.join(process.cwd(), 'config/Kirin/config.yml');

        if (!fs.existsSync(configPath)) {
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
            fs.writeFileSync(configPath, yml.stringify(defaultConfig));

            return defaultConfig;
        }

        return yml.parse(fs.readFileSync(configPath, 'utf8')) as KirinConfig;
    }

    public static getDefaultConfig(): KirinConfig {
        const defaultConfigPath = path.join(__dirname, 'Kirin/defaults/config.yml');
        return yml.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
    }
}

module.exports = new KirinModule();