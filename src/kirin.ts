import { SlashCommandBuilder, MessageCommandBuilder, RecipleClient, AnyCommandBuilder, RecipleScript } from 'reciple';
import { Logger, replaceAll, escapeRegExp } from 'fallout-utility';
import { Config, KirinConfig } from './Kirin/Config';
import { Action, Server } from './Kirin/Server';
import { AutocompleteInteraction, GuildMember, EmbedBuilder } from 'discord.js';

export class KirinMain implements RecipleScript {
    public versions: string = '^5.1.0';
    public config: KirinConfig = Config.getConfig();
    public client!: RecipleClient<boolean>;
    public logger!: Logger;
    public servers: Server[] = [];
    public commands?: AnyCommandBuilder[] = [];

    public async onStart(client: RecipleClient<boolean>): Promise<boolean> {
        this.logger = client.logger.cloneLogger({ loggerName: 'Kirin' });
        this.client = client;

        this.logger.log("Starting Kirin...");

        try {
            if (this.config.process.controlViaCommands) {
                this.commands = this.getCommands();
            }
        } catch (err) {
            this.logger.error(err);
        }

        this.client.on('interactionCreate', async interaction => {
            if (interaction.isAutocomplete()) return this.autoComplete(interaction);
            if (!interaction.isButton()) return;

            const splitId = interaction.customId.split('-');
            const action = splitId.pop();
            const id = splitId.join('-');

            if (!id || !action) return;

            const permissions = this.config.permissions[action as Action];
            const server = this.servers.find(s => s.id == id);
            if (!server) return;

            let error = false;
            await interaction.deferReply({ ephemeral: true }).catch(err => { this.logger.err(err); error = true; });
            if (error) return;

            const hasPermissions = !permissions.allowedPermissions.length || permissions.allowedPermissions.length && interaction.memberPermissions?.has(permissions.allowedPermissions);
            const hasRole = (interaction.member as GuildMember).roles.cache.find(r => permissions.allowedRoles.some(pr => pr == r.id || pr == r.name));

            if (!hasRole && !hasPermissions) {
                interaction.editReply(this.getMessage('noPermissions', 'You do not have permissions to do that'));
                return;
            }

            switch (action) {
                case 'start':
                    if (server.process || server.status == 'ONLINE') {
                        interaction.editReply(this.getMessage('alreadyStarted', 'Server is already running')).catch(() => {});
                        break;
                    }

                    server.start();
                    interaction.editReply(this.getMessage('starting', 'Starting...')).catch(() => {});

                    break;
                case 'stop':
                    if (!server.process || server.status == 'OFFLINE') {
                        interaction.editReply(this.getMessage('alreadyStopped', 'Server is already stopped')).catch(() => {});
                        break;
                    }

                    const stop = await server.stop().catch(() => false);
                    interaction.editReply(this.getMessage(stop ? 'stopped' : 'failedToStop', stop ? 'Stopping...' : 'Failed to stop server'));
                    break;
                default:
                    interaction.editReply(this.getMessage('unknownAction', 'Unknown interaction')).catch(() => {});
            }
        });

        return true;
    }

    public async onLoad(): Promise<void> {
        this.logger.log(`Loading servers...`);
        this.servers = await this.fetchServers();
        this.logger.log(`Loaded ${this.servers.length} server(s)`);

        this.logger.debug(`Pinging all servers...`);
        for (const server of this.servers) {
            server.ping(true);
            this.logger.debug(`Pinged ${server.id}`);
        }

        this.logger.log("Loaded Kirin...");
    }

    public async fetchServers(): Promise<Server[]> {
        const servers: Server[] = [];
        const serverLists = Config.getServers().servers;

        for (const serverOption of serverLists) {
            this.logger.debug(`Creating new server: ${serverOption.id}`);
            const server = new Server({ ...serverOption, kirin: this });

            await server.fetch().then(() => servers.push(server)).catch(err => server.logger.err(err));
        }

        return servers;
    }

    public async autoComplete(interaction: AutocompleteInteraction): Promise<void> {
        if (!['start','stop'].some(n => n == interaction.commandName)) return;

        const query = interaction.options.getFocused();
        const servers = this.servers.filter(s => s.id.includes(query) || s.options.name && s.options.name.includes(query));

        interaction.respond(
            servers.map(server => ({
                name: server.options.name ?? server.id,
                value: server.id
            }))
        ).catch(() => {});
    }

    public getCommands(): AnyCommandBuilder[] {
        return [
            new SlashCommandBuilder()
                .setName('start')
                .setDescription(this.getMessage('startDescription', 'Start a server'))
                .setRequiredMemberPermissions(this.config.permissions.start.allowedPermissions)
                .addStringOption(server => server
                    .setName('server')
                    .setDescription('Server to start')
                    .setRequired(true)
                    .setAutocomplete(true)
                )
                .setExecute(async command => {
                    const interaction = command.interaction;
                    const serverQuery = interaction.options.getString('server', true);
                    const server = this.servers.find(s => s.id == serverQuery || s.options.name && s.options.name.toLowerCase() == serverQuery.toLowerCase());
                    
                    await interaction.deferReply({ ephemeral: true });
                    if (!server) {
                        interaction.editReply(this.getMessage('serverNotFound', 'Server not found'));
                        return;
                    }
                    if (server.process || server.status === 'ONLINE') {
                        interaction.editReply(this.getMessage('alreadyStarted', 'Server is already running'));
                        return;
                    }

                    server.start();
                    interaction.editReply(this.getMessage('starting', 'Starting...'));
                }),
            new SlashCommandBuilder()
                .setName('stop')
                .setDescription(this.getMessage('stopDescription', 'Stop a server'))
                .setRequiredMemberPermissions(this.config.permissions.stop.allowedPermissions)
                .addStringOption(server => server
                    .setName('server')
                    .setDescription('Server to stop')
                    .setRequired(true)
                    .setAutocomplete(true)    
                )
                .setExecute(async command => {
                    const interaction = command.interaction;
                    const serverQuery = interaction.options.getString('server', true);
                    const server = this.servers.find(s => s.id == serverQuery || s.options.name && s.options.name.toLowerCase() == serverQuery.toLowerCase());
                    
                    await interaction.deferReply({ ephemeral: true });
                    if (!server) {
                        interaction.editReply(this.getMessage('serverNotFound', 'Server not found'));
                        return;
                    }
                    if (!server.process || server.status == 'OFFLINE') {
                        interaction.editReply(this.getMessage('alreadyStopped', 'Server is already stopped'));
                        return;
                    }

                    const stop = await server.stop().catch(() => false);
                    interaction.editReply(this.getMessage(stop ? 'stopped' : 'failedToStop', stop ? 'Stopping...' : 'Failed to stop server'));
                }),
            ...(this.config.process.initServerMessageCommand ?
                    [
                        new MessageCommandBuilder()
                        .setName('init')
                        .setDescription('Make new message for new server embed')
                        .setRequiredMemberPermissions(...this.config.permissions.init.allowedPermissions)
                        .setExecute(async command => {
                            const message = command.message;
                            const embed = new EmbedBuilder()
                                .setAuthor({ name: 'Messsage Info' })
                                .setColor(this.getMessage('onlineEmbedColor', 'Blue'))
                                .addFields({ name: 'channel_id', value: `\`\`\`\n${message.channel.id}\n\`\`\`` });

                            const reply = await message.channel.send({ embeds: [embed] });
                            reply.edit({ embeds: [embed.addFields({ name: 'message_id', value: `\`\`\`\n${reply.id}\n\`\`\`` })] });
                        })
                    ]
                : [])
        ];
    }

    public getMessage<T extends any>(message: string, defaultMessage?: T, ...placeholders: string[]): T {
        let msg = this.config.messages[message] ?? defaultMessage ?? message;

        let id = 0;
        for (const placeholder of placeholders) {
            msg = replaceAll(msg, escapeRegExp(`{${id}}`), escapeRegExp(placeholder));
            id++;
        }

        return msg as T;
    }
}

export default new KirinMain();
