import { Channel, Collection, EmbedBuilder, Guild, Interaction, Message, RepliableInteraction, escapeInlineCode, inlineCode, time } from 'discord.js';
import { Server, ServerData, ServerStatus } from './Server.js';
import { Kirin } from '../../Kirin.js';
import { existsSync, lstatSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import { Logger } from 'fallout-utility';
import { TypedEmitter } from 'tiny-typed-emitter';
import { PingData } from '../utils/ping.js';
import { ChildProcess } from 'child_process';

export interface ServerManagerEvents {
    serverCreate: (server: Server) => any;
    serverDelete: (server: Server) => any;
    serverUpdate: (server: Server, oldServerData: ServerData) => any;
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

        this.on('serverPing', (oP, nP, srv) => srv.logger?.debug(`STATUS: ${srv.status}`));
        this.on('serverProcessStdout', (msg, srv) => srv.logger?.log(msg));
        this.on('serverProcessStderr', (msg, srv) => srv.logger?.err(msg));
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

            await this.handleActionInteraction(interaction, server, action, true);
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

    public async handleActionInteraction(interaction: RepliableInteraction, server: Server, action: 'start'|'stop'|'info', ephemeralReplies?: boolean): Promise<void> {
        if (!interaction.replied && !interaction.deferred) await interaction.deferReply({ ephemeral: ephemeralReplies !== false });

        switch (action) {
            case 'start':
                if (!server.isStopped()) {
                    await interaction.editReply(`${inlineCode(escapeInlineCode(server.name))} is already starting`);
                    return;
                }

                await server.start();
                await interaction.editReply(`${inlineCode(escapeInlineCode(server.name))} **is starting**`);
                break;
            case 'stop':
                if (server.isStopped()) {
                    await interaction.editReply(`${inlineCode(escapeInlineCode(server.name))} is not started`);
                    return;
                }

                await server.stop();
                await interaction.editReply(`${inlineCode(escapeInlineCode(server.name))} **is stopping**`);
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
