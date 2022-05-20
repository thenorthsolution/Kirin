import { RecipleClient, RecipleScript } from 'reciple';
import { replaceAll } from 'fallout-utility';
import defaultConfig from './defaults/config';
import discord from 'discord.js';
import path from 'path';
import yml from 'yaml';
import fs from 'fs';
import { KirinServer, KirinServerOptions } from './Server';
import start from './start';
import stop from './stop';
import restart from './restart';

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
            if (interaction.isAutocomplete()) return this.interactionAutocomplete(interaction);
            if (!interaction.isButton() && !interaction.isSelectMenu()) return;
            if (interaction.isButton() && !interaction.customId.startsWith('kirin-server')) return;
            if (interaction.isSelectMenu() && !interaction.customId.startsWith('kirin-server-menu')) return;
            
            const serverId = interaction.customId.split('-').pop();
            if (!serverId || !this.servers.some(s => s.id)) return;

            const server = this.servers.find(s => s.id === serverId);
            if (!server) return;

            let action = interaction.customId.split('-')[2];
                action = action == 'menu' && interaction.isSelectMenu() ? (interaction.values[0].split('-')[2] ?? action) : action;

            switch (action) {
                case 'start': start(server, interaction); break;
                case 'stop': stop(server, interaction); break;
                case 'restart': restart(server, interaction); break;
                default: break;
            }
        });
    }

    public async interactionAutocomplete(interaction: discord.AutocompleteInteraction) {
        if (!interaction.isAutocomplete()) return;
        if (interaction.commandName !== 'start' && interaction.commandName !== 'stop' && interaction.commandName !== 'restart') return;

        const query = interaction.options.getFocused().toString();
        const servers = this.servers.filter(s => s.config.displayName.toLowerCase().startsWith(query.toLowerCase()));
        if (servers.length === 0) return;

        await interaction.respond(servers.map(s => {
            return {
                name: s.config.displayName,
                value: s.id,
            };
        })).catch(err => this.client.logger.error(err));
    }

    public async parseServers() {
        const rawServers = KirinModule.getServers();
        this.servers.forEach(s => s.deleted = true);
        this.servers = [];

        this.client.logger.info(`Parsing ${rawServers.length} servers...`);
        for (const rawServer of rawServers) {
            try {
                const server = new KirinServer({
                        ...this.config.defaultServerConfig,
                        ...rawServer
                    }, this);

                server.init().catch(err => this.client.logger.error(err));
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
            message = replaceAll(message, `\\{${i}\\}`, `${placeholder}`);
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
        const defaultConfigObject = this.getDefaultConfig();
        const configPath = path.join(process.cwd(), 'config/Kirin/config.yml');

        if (!fs.existsSync(configPath)) {
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
            fs.writeFileSync(configPath, yml.stringify(defaultConfigObject));

            return defaultConfigObject;
        }

        return yml.parse(fs.readFileSync(configPath, 'utf8')) as KirinConfig;
    }

    public static getDefaultConfig(): KirinConfig {
        return yml.parse(defaultConfig);
    }
}