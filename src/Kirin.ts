import { AnyCommandBuilder, AnyCommandData, RecipleClient, RecipleModuleScriptUnloadData, RecipleModuleScript, SlashCommandBuilder, cli } from 'reciple';
import { Logger, recursiveObjectReplaceValues } from 'fallout-utility';
import { ServerManager } from './Kirin/classes/ServerManager.js';
import { serverOption } from './Kirin/utils/commandOption.js';
import { Config, getConfig } from './Kirin/utils/config.js';
import { commandHalt } from './Kirin/utils/commandHalt.js';
import { APIClient } from './Kirin/classes/APIClient.js';
import path from 'path';

export class Kirin implements RecipleModuleScript {
    readonly versions: string = '^7';
    readonly config: Config = getConfig();

    public logger?: Logger;
    public client!: RecipleClient;
    public apiClient!: APIClient;
    public servers!: ServerManager;
    public serversDir: string = path.join(cli.cwd, this.config.serversFolders);

    readonly commands: (AnyCommandBuilder|AnyCommandData)[] = !this.config.command.enabled
        ? []
        : [
            new SlashCommandBuilder()
                .setName('server')
                .setDescription('Manage Minecraft servers')
                .setRequiredMemberPermissions(this.config.command.requiredPermissions)
                .addSubcommand(start => serverOption(start).setName('start').setDescription('Start a server'))
                .addSubcommand(stop => serverOption(stop).setName('stop').setDescription('Stop a server'))
                .addSubcommand(info => serverOption(info).setName('info').setDescription('Get information about a server'))
                .setExecute(async ({ interaction }) => {
                    if (!interaction.inCachedGuild()) return;

                    const action = interaction.options.getSubcommand() as 'start'|'stop'|'info';
                    const serverId = interaction.options.getString('server', true);

                    await interaction.deferReply({ ephemeral: this.config.command.ephemeralReplies })

                    const server = this.servers.cache.find(s => s.id === serverId);

                    if (!server) {
                        await interaction.editReply(recursiveObjectReplaceValues(this.config.messages.serverNotFound, '{server_id}', serverId));
                        return;
                    }

                    await this.servers.handleActionInteraction(interaction, server, action, this.config.command.ephemeralReplies);
                })
                .setHalt(commandHalt)
        ];

    public async onStart(client: RecipleClient<false>): Promise<boolean> {
        this.logger = client.logger?.clone({ name: 'Kirin' });
        this.client = client;
        this.apiClient = new APIClient(this);
        this.servers = new ServerManager(this);

        this.logger?.log(`Starting Kirin...`);
        return true;
    }

    public async onLoad(client: RecipleClient<true>): Promise<void> {
        if (this.config.api.enabled) {
            await this.apiClient.start();
            this.logger?.log(`Kirin is now active! http://127.0.0.1:${this.config.api.port}`);
        }

        await this.servers.loadServersFromDir(this.serversDir)
    }

    public async onUnload(unloadData: RecipleModuleScriptUnloadData): Promise<void> {
        for (const [id, server] of this.servers.cache) {
            if (server.message?.components.length) await server.message?.edit({ components: [] }).catch(() => null);
        }

        this.servers.unmountClientListeners();
    }
}

export default new Kirin();
