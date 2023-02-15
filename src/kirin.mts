import { RecipleClient, RecipleModuleScriptUnloadData } from '@reciple/client';
import { AutocompleteInteraction, ButtonInteraction, Collection, EmbedBuilder } from 'discord.js';
import { Logger } from 'fallout-utility';
import { RecipleModule, RecipleModuleScript } from 'reciple';
import { Server } from './Kirin/classes/Server.mjs';
import { KirinConfig, createConfig } from './Kirin/utils/config.mjs';
import { ServerConfig, createServersConfig } from './Kirin/utils/serversConfig.mjs';

export class KirinModule implements RecipleModuleScript {
    public client!: RecipleClient;
    public logger?: Logger;

    readonly versions: string[] = ['^7.0.4'];

    public config: KirinConfig = createConfig();
    public serversConfig: ServerConfig[] = createServersConfig();
    public servers: Collection<string, Server> = new Collection();

    public async onStart(client: RecipleClient<false>, module: RecipleModule): Promise<boolean> {
        this.client = client;
        this.logger = client.logger?.clone({ name: 'Kirin' });

        this.logger?.log(`Starting Kirin...`);

        return true;
    }

    public async onLoad(client: RecipleClient<true>, module: RecipleModule): Promise<void> {
        this.logger?.log(`Loading servers...`);

        this.servers = await Server.fetchServers(this, true);

        this.logger?.log(`Loaded ${this.servers.size} servers`);

        client.on('interactionCreate', async interaction => {
            if (interaction.isAutocomplete()) return this.handleAutoCompleteInteraction(interaction);
            if (interaction.isButton()) return this.handleButtonInteraction(interaction);
        });
    }

    public async onUnload(unloadData: RecipleModuleScriptUnloadData): Promise<void> {
        this.logger?.log(`Stopping attached servers...`);

        for (const server of this.servers.toJSON()) {
            try {
                await server.message?.edit({ embeds: [server.messageContent.getUnloadedEmbed()], components: [] });

                if (server.options.stopServerOnExit) {
                    const stopped = await server.stop();

                    if (stopped) {
                        this.logger?.log(`Stopped ${server.name}`);
                    } else {
                        this.logger?.err(`Failed to stop ${server.name}`);
                    }
                }
            } catch (err) {
                this.logger?.err(`An error occured while unloading server: ${server.name}`);
            }
        }

        this.logger?.log(`Unloaded Kirin!`);
    }

    public async handleAutoCompleteInteraction(interaction: AutocompleteInteraction): Promise<void> {}

    public async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
        const [kirin, action, id] = interaction.customId.split('-') as [string, 'start'|'stop', string];
        if (kirin !== 'kirin' || !action || !id) return;

        const actions = ['start', 'stop'];
        if (!actions.includes(action)) return;

        await interaction.deferReply({ ephemeral: true });

        const server = this.servers.get(id);
        if (!server) {
            await interaction.editReply({ embeds: [this.errorEmbed('Server not found')] });
            return;
        }

        switch (action) {
            case 'start':
                if (!server.isStopped()) {
                    await interaction.editReply({ embeds: [this.errorEmbed(`Server is already started`)] })
                    return;
                }

                await server.start().catch(err => this.logger?.err(`An error occured while trying to start server ${server.name}:\n`, err));
                await interaction.editReply({ embeds: [this.successEmbed('Server is starting')] });
                break;
            case 'stop':
                if (server.isStopped()) {
                    await interaction.editReply({ embeds: [this.errorEmbed(`Server is not started`)] });
                    return;
                }

                await server.stop().catch(err => this.logger?.err(`An error occured while trying to stop server ${server.name}:\n`, err));
                await interaction.editReply({ embeds: [this.successEmbed('Server is stopping')] });
                break;
        }
    }

    public async resolveFromCachedManager<V>(id: string, manager: { cache: Collection<string, V>; fetch(key: string): Promise<V|null> }): Promise<V> {
        const data = manager.cache.get(id) ?? await manager.fetch(id);
        if (data === null) throw new Error(`Couldn't fetch (${id}) from manager`);
        return data;
    }

    public getMessage<T = string>(key: keyof KirinConfig['messages']): T {
        return this.config.messages[key] as T;
    }

    public errorEmbed(message: string, useDescription: boolean = false): EmbedBuilder {
        const embed = new EmbedBuilder();

        if (useDescription) {
            embed.setDescription(`❌ ┃ ${message}`);
        } else {
            embed.setAuthor({
                name: `❌ ┃ ${message}`,
                iconURL: this.client.user?.displayAvatarURL()
            });
        }

        return embed;
    }

    public successEmbed(message: string, useDescription: boolean = false): EmbedBuilder {
        const embed = new EmbedBuilder();

        if (useDescription) {
            embed.setDescription(`✔️ ┃ ${message}`);
        } else {
            embed.setAuthor({
                name: `✔️ ┃ ${message}`,
                iconURL: this.client.user?.displayAvatarURL()
            });
        }

        return embed;
    }
}

export default new KirinModule();
