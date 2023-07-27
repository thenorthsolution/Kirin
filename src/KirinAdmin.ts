import { APIModalInteractionResponseCallbackData, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, Message, TextInputBuilder, TextInputStyle, codeBlock } from 'discord.js';
import { AnyCommandBuilder, AnyCommandData, RecipleClient, RecipleModuleScript, SlashCommandBuilder, cli } from 'reciple';
import { recursiveObjectReplaceValues } from 'fallout-utility';
import { Server, ServerData } from './Kirin/classes/Server.js';
import { serverOption } from './Kirin/utils/commandOption.js';
import { commandHalt } from './Kirin/utils/commandHalt.js';
import kirin, { Kirin } from './Kirin.js';
import { randomBytes } from 'crypto';
import path from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';

export class KirinAdmin implements RecipleModuleScript {
    readonly versions: string = '^7';
    readonly commands: (AnyCommandBuilder | AnyCommandData)[] = [];

    public client!: RecipleClient;
    public kirin: Kirin = kirin;

    public async onStart(client: RecipleClient<false>): Promise<boolean> {
        this.client = client;
        this.commands.push(
            new SlashCommandBuilder()
                .setName('kirin')
                .setDescription('Kirin configuration command')
                .setRequiredMemberPermissions('Administrator')
                .addSubcommandGroup(server => server
                    .setName('server')
                    .setDescription('Manage minecraft servers')
                    .addSubcommand(create => create
                        .setName('create')
                        .setDescription('Create a kirin server')
                        .addStringOption(name => name.setName('name').setDescription('Server name').setRequired(true))
                        .addStringOption(ip => ip.setName('ip').setDescription('Local IP and Port').setRequired(true))
                        .addStringOption(protocol => protocol.setName('protocol').setDescription('Server protocol').setChoices({ name: 'Java', value: 'java' }, { name: 'Bedrock', value: 'bedrock' }).setRequired(true))
                        .addBooleanOption(componentMessage => componentMessage.setName('create-message').setDescription('Create message with buttons to stop/start server').setRequired(true))
                        .addStringOption(description => description.setName('description').setDescription('Server name').setRequired(false))
                    )
                    .addSubcommand(del => serverOption(del)
                        .setName('delete')
                        .setDescription('Delete a kirin server')
                    )
                )
                .setExecute(async ({ interaction }) => {
                    const action = interaction.options.getSubcommand() as 'create'|'delete';
                    const serverId = interaction.options.getString('server') || '';
                    const server = serverId ? this.kirin.servers.cache.get(serverId) : null;


                    switch (action) {
                        case 'create':
                            await this.interactionCreateServer(interaction);
                            break;
                        case 'delete':
                            await interaction.deferReply({ ephemeral: true });

                            if (!server) {
                                await interaction.editReply(recursiveObjectReplaceValues(this.kirin.config.messages.serverNotFound, '{server_id}', serverId));
                                return;
                            }

                            if (!server.isStopped()) {
                                await interaction.editReply(server.replacePlaceholders(this.kirin.config.messages.serverIsOnline));
                                return;
                            }

                            await server.delete(true);
                            await interaction.editReply(server.replacePlaceholders(this.kirin.config.messages.serverDeleted));

                            break;
                    }
                })
                .setHalt(commandHalt)
        );

        return true;
    }

    public async interactionCreateServer(interaction: ChatInputCommandInteraction): Promise<void> {
        const name = interaction.options.getString('name', true);
        const description = interaction.options.getString('description');
        const protocol = interaction.options.getString('protocol', true) as 'java'|'bedrock';
        const ip = interaction.options.getString('ip', true);
        const createMessage = interaction.options.getBoolean('create-message', true);

        const modal: APIModalInteractionResponseCallbackData = {
            title: 'Server Information',
            custom_id: 'kirin-server-modal',
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        new TextInputBuilder()
                            .setCustomId('cwd')
                            .setLabel('Server root directory')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('/Users/user/Documents/testserver')
                            .setValue(cli.cwd)
                            .toJSON()
                    ]
                },
                {
                    type: ComponentType.ActionRow,
                    components: [
                        new TextInputBuilder()
                            .setCustomId('jar')
                            .setLabel('Jar file')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('spigot.jar')
                            .setValue('server.jar')
                            .toJSON()
                    ]
                },
                {
                    type: ComponentType.ActionRow,
                    components: [
                        new TextInputBuilder()
                            .setCustomId('args')
                            .setLabel('Java args (Optional)')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('-Xmx2000M -Xms2000M')
                            .setRequired(false)
                            .toJSON()
                    ]
                },
                {
                    type: ComponentType.ActionRow,
                    components: [
                        new TextInputBuilder()
                            .setCustomId('serverArgs')
                            .setLabel('Server args (Optional)')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('--nogui')
                            .setValue('--nogui')
                            .setRequired(false)
                            .toJSON()
                    ]
                }
            ]
        };

        await interaction.showModal(modal);

        const modalInteraction = await interaction.awaitModalSubmit({
            time: 1000 * 60 * 60
        });

        await modalInteraction.deferReply({ ephemeral: true });

        const serverData: ServerData = {
            name,
            protocol,
            description: description || undefined,
            ip: !isNaN(Number(ip)) ? `127.0.0.1:${ip}` : ip,
            server: {
                command: 'java',
                cwd: modalInteraction.fields.getTextInputValue('cwd'),
                jar: modalInteraction.fields.getTextInputValue('jar'),
                args: modalInteraction.fields.getTextInputValue('args').split(/(\s+)/).filter(v => v.trim()),
                serverArgs: modalInteraction.fields.getTextInputValue('serverArgs').split(/(\s+)/).filter(v => v.trim()),
                killOnBotStop: false,
                killSignal: 'SIGINT'
            },
            messages: {
                starting: { content: ' ', embeds: [new EmbedBuilder().setAuthor({ name: 'Server is starting' }).setTitle('{server_name}').setDescription('{server_description}').setColor('Blue').toJSON()] },
                online: { content: ' ', embeds: [new EmbedBuilder().setAuthor({ name: 'Server is online' }).setTitle('{server_name}').setDescription('{server_description}').setColor('Green').toJSON()] },
                offline: { content: ' ', embeds: [new EmbedBuilder().setAuthor({ name: 'Server is offline' }).setTitle('{server_name}').setDescription('{server_description}').setColor('DarkButNotBlack').toJSON()] },
                unattached: { content: ' ', embeds: [new EmbedBuilder().setAuthor({ name: 'Server is online' }).setTitle('{server_name}').setDescription('{server_description}').setColor('DarkerGrey').toJSON()] }
            },
            components: {
                start: { type: 2, style: ButtonStyle.Secondary, label: 'Start' },
                stop: { type: 2, style: ButtonStyle.Danger, label: 'Stop' },
            },
            permissions: {
                start: ['ViewChannel'],
                stop: ['ViewChannel'],
            },
            ping: {
                pingInterval: 20000,
                pingTimeout: 10000
            }
        };

        let message: Message|null = null;

        if (createMessage) {
            message = await interaction.channel?.send(`Initial message for **${serverData.name}**`) || null;

            if (message) {
                serverData.channelId = message.channel.id;
                serverData.messageId = message.id;
            }
        }

        try {
            Server.validateServerData(serverData);
        } catch(err) {
            await message?.delete().catch(() => {});
            await modalInteraction.editReply(err instanceof Error ? err.message : String(err));
            return;
        }

        const file = path.join(this.kirin.serversDir, randomBytes(10).toString('base64url') + '.json');

        await mkdir(this.kirin.serversDir, { recursive: true });
        await writeFile(file, JSON.stringify(serverData, null, 2));

        let err: any;

        const server = await Server.from(file, this.kirin, true).catch(error => {
            err = error;
        });

        if (!server) {
            this.kirin.logger?.err(err);
            await interaction.editReply(`An error occured while creating server!\n${codeBlock(String(err))}`);
            await message?.delete().catch(() => {});
            await rm(file, { force: true });
            return;
        }

        await modalInteraction.editReply('Server created!');
    }
}

export default new KirinAdmin();
