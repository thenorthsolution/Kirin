import { RecipleClient, RecipleModuleScriptUnloadData } from '@reciple/client';
import { Logger } from 'fallout-utility';
import { AnyCommandBuilder, AnyCommandData, RecipleModule, RecipleModuleScript, SlashCommandBuilder, cwd } from 'reciple';
import { APIClient } from './Kirin/classes/APIClient.js';
import { Config, getConfig } from './Kirin/utils/config.js';
import { ServerManager } from './Kirin/classes/ServerManager.js';
import path from 'path';
import { serverOption } from './Kirin/utils/commandOption.js';
import { EmbedBuilder, escapeInlineCode, inlineCode, time } from 'discord.js';

export class Kirin implements RecipleModuleScript {
    readonly versions: string = '^7';
    readonly config: Config = getConfig();

    public logger?: Logger;
    public client!: RecipleClient;
    public apiClient!: APIClient<true>;
    public servers!: ServerManager;
    public serversDir: string = path.join(cwd, this.config.serversFolders);

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
                    const action = interaction.options.getSubcommand() as 'start'|'stop'|'info';
                    const serverId = interaction.options.getString('server', true);

                    await interaction.deferReply({ ephemeral: this.config.command.ephemeralReplies })

                    const server = this.servers.cache.find(s => s.id === serverId);

                    if (!server) {
                        await interaction.editReply(`❌  **|  Couldn't find server with ID of** ${inlineCode(escapeInlineCode(serverId))}`);
                        return;
                    }

                    await this.servers.handleActionInteraction(interaction, server, action, this.config.command.ephemeralReplies);
                })
        ];

    public async onStart(client: RecipleClient<false>, module: RecipleModule): Promise<boolean> {
        this.logger = client.logger?.clone({ name: 'Kirin' });
        this.client = client;
        this.apiClient = new APIClient(this);
        this.servers = new ServerManager(this);

        this.logger?.log(`Starting Kirin...`);
        return true;
    }

    public async onLoad(client: RecipleClient<true>, module: RecipleModule): Promise<void> {
        if (this.config.api.enabled) {
            await this.apiClient.start();
            this.logger?.log(`Kirin is now active! http://127.0.0.1:${this.config.api.port}`);
        }

        await this.servers.loadServersFromDir(this.serversDir)
    }

    public async onUnload(unloadData: RecipleModuleScriptUnloadData): Promise<void> {
        this.servers.unmountClientListeners();
    }
}

export default new Kirin();
