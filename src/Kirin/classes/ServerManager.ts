import { Channel, Collection, EmbedBuilder, Guild, Interaction, Message, RepliableInteraction, escapeInlineCode, inlineCode, time } from 'discord.js';
import { existsSync, lstatSync, mkdirSync, readdirSync } from 'fs';
import { Server, ServerData, ServerStatus } from './Server.js';
import { TypedEmitter } from 'tiny-typed-emitter';
import { ChildProcess } from 'child_process';
import { PingData } from '../utils/ping.js';
import { Logger } from 'fallout-utility';
import { Kirin } from '../../Kirin.js';
import path from 'path';

export interface ServerManagerEvents {
    serverCreate: (server: Server) => any;
    serverDelete: (server: Server) => any;
    serverUpdate: (oldServer: ServerData, newServer: Server) => any;
    serverStart: (server: Server) => any;
    serverStop: (server: Server) => any;
    serverProcessStart: (childProcess: ChildProcess, server: Server) => any;
    serverProcessStop: (childProcess: ChildProcess, server: Server) => any;
    serverProcessError: (error: Error, server: Server) => any;
    serverProcessStdout: (message: string, server: Server) => any;
    serverProcessStderr: (message: string, server: Server) => any;
    serverPing: (oldPing: PingData|undefined, newPing: PingData, server: Server) => any;
    serverStatusUpdate: (oldStatus: ServerStatus, newStatus: ServerStatus, server: Server) => any;
}

export class ServerManager extends TypedEmitter<ServerManagerEvents> {
    readonly cache: Collection<string, Server<true>> = new Collection();
    readonly logger?: Logger;

    constructor(readonly kirin: Kirin) {
        super();
        this.logger = kirin.logger?.clone({ name: 'Kirin/ServerManager' });

        this._onGuildDelete = this._onGuildDelete.bind(this);
        this._onChannelDelete = this._onChannelDelete.bind(this);
        this._onMessageDelete = this._onMessageDelete.bind(this);
        this._onInteractionCreate = this._onInteractionCreate.bind(this);

        this.kirin.client.on('guildDelete', this._onGuildDelete);
        this.kirin.client.on('channelDelete', this._onChannelDelete);
        this.kirin.client.on('messageDelete', this._onMessageDelete);
        this.kirin.client.on('interactionCreate', this._onInteractionCreate);

        this.on('serverCreate', server => this.kirin.apiClient.socket?.sockets.emit('serverCreate', server.toJSON()));
        this.on('serverDelete', server => this.kirin.apiClient.socket?.sockets.emit('serverDelete', server.toJSON()));
        this.on('serverUpdate', (oldServerOptions, newServer) => this.kirin.apiClient.socket?.sockets.emit('serverUpdate', oldServerOptions, newServer.toJSON()));
        this.on('serverStart', server => this.kirin.apiClient.socket?.sockets.emit('serverStart', server.toJSON()));
        this.on('serverStop', server => this.kirin.apiClient.socket?.sockets.emit('serverStop', server.toJSON()));
        this.on('serverProcessStart', (childProcess, server) => this.kirin.apiClient.socket?.sockets.emit('serverProcessStart', childProcess.pid ?? -1, server.toJSON()));
        this.on('serverProcessStop', (childProcess, server) => this.kirin.apiClient.socket?.sockets.emit('serverProcessStop', childProcess.pid ?? -1, server.toJSON()));
        this.on('serverProcessError', (error, server) => this.kirin.apiClient.socket?.sockets.emit('serverProcessError', error.message, server.toJSON()));

        this.on('serverProcessStdout', (message, server) => {
            server.logger?.log(message);
            this.kirin.apiClient.socket?.sockets.emit('serverProcessStdout', message, server.toJSON());
        });

        this.on('serverProcessStderr', (message, server) => {
            server.logger?.err(message);
            this.kirin.apiClient.socket?.sockets.emit('serverProcessStderr', message, server.toJSON());
        });

        this.on('serverPing', (oldPingData, newPingData, server) => {
            server.logger?.debug(`STATUS: ${server.status}; (old: ${oldPingData?.status || 'Null'} | new: ${newPingData.status})`);
            this.kirin.apiClient.socket?.sockets.emit('serverPing', oldPingData ?? null, newPingData, server.toJSON());
        });

        this.on('serverStatusUpdate', (oldStatus, newStatus, server) => this.kirin.apiClient.socket?.sockets.emit('serverStatusUpdate', oldStatus, newStatus, server.toJSON()));
    }

    public async loadServersFromDir(dir: string, cache: boolean = true): Promise<Server[]> {
        dir = path.resolve(dir);

        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

        const files = readdirSync(dir).map(f => path.join(dir, f)).filter(f => lstatSync(f).isFile());
        const loaded: Server[] = [];

        for (const file of files) {
            try {
                const server = await Server.from(file, this.kirin, cache);
                loaded.push(server);
            } catch (err) {
                this.logger?.error(`Failed to load server file from '${file}':\n`, err);
            }
        }

        return loaded;
    }

    public unmountClientListeners(): void {
        this.kirin.client.removeListener('guildDelete', this._onGuildDelete);
        this.kirin.client.removeListener('channelDelete', this._onChannelDelete);
        this.kirin.client.removeListener('messageDelete', this._onMessageDelete);
        this.kirin.client.removeListener('interactionCreate', this._onInteractionCreate);
    }

    private async _onGuildDelete(guild: Guild): Promise<void> {
        const servers = this.cache.filter(s => s.guild?.id === guild.id);

        for (const server of (servers?.toJSON() || [])) {
            await server.delete(false);
        }
    }

    private async _onChannelDelete(channel: Channel): Promise<void> {
        const servers = this.cache.filter(s => s.channel?.id === channel.id);

        for (const server of (servers?.toJSON() || [])) {
            await server.delete(false);
        }
    }

    private async _onMessageDelete(message: Message): Promise<void> {
        const servers = this.cache.filter(s => s.message?.id === message.id);

        for (const server of (servers?.toJSON() || [])) {
            await server.delete(false);
        }
    }

    private async _onInteractionCreate(interaction: Interaction): Promise<void> {
        if (!interaction.inCachedGuild()) return;

        if (interaction.isButton()) {
            const [kirin, action, serverId] = interaction.customId.split('-') as ['kirin', 'start'|'stop', string];
            if (!['start', 'stop'].includes(action)) return;

            const server = this.cache.get(serverId);
            if (!server) return;

            await this.handleActionInteraction(interaction, server, action, true).catch(() => {});
        }

        if (interaction.isAutocomplete()) {
            const option = interaction.options.getFocused(true);
            const name = option.name;
            const value = option.value.toLowerCase();

            if (name !== 'server') return;

            const servers = this.cache.filter(s => s.name.toLowerCase() === value || s.name.toLowerCase().includes(value) || s.description?.toLowerCase()?.includes(value) || s.ip.includes(value));

            await interaction.respond(servers.map(s => ({ name: s.name, value: s.id }))).catch(() => {});
        }
    }

    public async handleActionInteraction(interaction: RepliableInteraction<"cached">, server: Server, action: 'start'|'stop'|'info', ephemeralReplies?: boolean): Promise<void> {
        if (!interaction.replied && !interaction.deferred) await interaction.deferReply({ ephemeral: ephemeralReplies !== false });

        switch (action) {
            case 'start':
                if (server.status === 'Online') {
                    await interaction.editReply(server.replacePlaceholders(this.kirin.config.messages.serverAlreadyStarted));
                    return;
                }

                if (server.permissions.start && !interaction.memberPermissions.has(server.permissions.start)) {
                    await interaction.editReply(server.replacePlaceholders(this.kirin.config.messages.noStartPermissions));
                    return;
                };

                await server.start();
                await interaction.editReply(server.replacePlaceholders(this.kirin.config.messages.serverStarting));
                break;
            case 'stop':
                if (server.status === 'Offline') {
                    await interaction.editReply(server.replacePlaceholders(this.kirin.config.messages.serverAlreadyStopped));
                    return;
                }

                if (server.status === 'Unattached') {
                    await interaction.editReply(server.replacePlaceholders(this.kirin.config.messages.serverIsUnattached));
                    return;
                }

                if (server.permissions.stop && !interaction.memberPermissions.has(server.permissions.stop)) {
                    await interaction.editReply(server.replacePlaceholders(this.kirin.config.messages.noStopPermissions));
                    return;
                };

                await server.stop();
                await interaction.editReply(server.replacePlaceholders(this.kirin.config.messages.serverStopping));
                break;
            case 'info':
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(server.name)
                            .setDescription(server.description || null)
                            .setColor(server.status === 'Online' ? 'Green' : 'Grey')
                            .setFields(
                                {
                                    name: 'Last Updated',
                                    value: server.lastPing ? time(server.lastPing.pingedAt, 'R') : '*Never*',
                                    inline: true
                                },
                                {
                                    name: 'Version',
                                    value: server.lastPing?.version || '*Unknown*',
                                    inline: true
                                },
                                {
                                    name: 'Status',
                                    value: server.status,
                                    inline: true
                                }
                            )
                            .setFooter({ text: `ID: ${server.id}` })
                            .setTimestamp()
                    ]
                });

                break;
        }
    }
}
