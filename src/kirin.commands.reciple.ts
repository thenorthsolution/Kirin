import { InteractionCommandBuilder, MessageCommandBuilder, RecipleScript } from 'reciple';
import { isNumber } from 'fallout-utility';
import { KirinModule } from './Kirin';
import discord from 'discord.js';
import start from './Kirin/start';
import stop from './Kirin/stop';
import restart from './Kirin/restart';
import path from 'path';
import yml from 'yaml';
import fs from 'fs';
import { KirinServerOptions } from './Kirin/Server';

export interface KirinCommandsConfig {
    start: boolean;
    stop: boolean;
    restart: boolean;
    createServer: boolean;
}

class KirinModuleCommands implements RecipleScript {
    public kirin: KirinModule = require('./kirin.reciple');
    public versions = [...this.kirin.versions];
    public config = KirinModuleCommands.getConfig();
    public commands: (InteractionCommandBuilder|MessageCommandBuilder)[] = [];

    public onStart() {
        if (this.config.start) this.addStartCommand();
        if (this.config.stop) this.addStopCommand();
        if (this.config.restart) this.addRestartCommand();
        if (this.config.createServer) this.addCreateServerCommand();

        return true;
    }

    public addStartCommand() {
        this.commands.push(
            new InteractionCommandBuilder()
                .setName('start')
                .setDescription('Start a server')
                .addStringOption(server => server
                    .setName('server')
                    .setDescription('The server to start')
                    .setAutocomplete(true)
                    .setRequired(true)
                )
                .setExecute(async command => {
                    const server = this.findServer(command.interaction.options.getString('server', true));
                    if (!server) return command.interaction.reply({
                        embeds: [
                            new discord.MessageEmbed()
                                .setDescription(this.kirin.getMessage('serverNotFound', command.interaction.options.getString('server', true)))
                                .setColor('RED')
                        ]
                    });

                    start(server, command.interaction);
                })
        )
    }

    public addStopCommand() {
        this.commands.push(
            new InteractionCommandBuilder()
                .setName('stop')
                .setDescription('Stop a server')
                .addStringOption(server => server
                    .setName('server')
                    .setDescription('The server to stop')
                    .setAutocomplete(true)
                    .setRequired(true)
                )
                .setExecute(async command => {
                    const server = this.findServer(command.interaction.options.getString('server', true));
                    if (!server) return command.interaction.reply({
                        embeds: [
                            new discord.MessageEmbed()
                                .setDescription(this.kirin.getMessage('serverNotFound', command.interaction.options.getString('server', true)))
                                .setColor('RED')
                        ]
                    });

                    stop(server, command.interaction);
                })
        )
    }

    public addRestartCommand() {
        this.commands.push(
            new InteractionCommandBuilder()
                .setName('restart')
                .setDescription('Restart a server')
                .addStringOption(server => server
                    .setName('server')
                    .setDescription('The server to restart')
                    .setAutocomplete(true)
                    .setRequired(true)
                )
                .setExecute(async command => {
                    const server = this.findServer(command.interaction.options.getString('server', true));
                    if (!server) return command.interaction.reply({
                        embeds: [
                            new discord.MessageEmbed()
                                .setDescription(this.kirin.getMessage('serverNotFound', command.interaction.options.getString('server', true)))
                                .setColor('RED')
                        ]
                    });

                    restart(server, command.interaction);
                })
        )
    }

    public addCreateServerCommand() {
        const modal = new discord.Modal()
            .setCustomId('kirin-create-server')
            .setTitle('Add Server')
            .addComponents(
                new discord.MessageActionRow<discord.TextInputComponent>()
                    .addComponents([
                        new discord.TextInputComponent()
                            .setCustomId('display-name')
                            .setLabel('Display Name')
                            .setPlaceholder('My server')
                            .setStyle('SHORT')
                            .setRequired(true),
                    ]),
                new discord.MessageActionRow<discord.TextInputComponent>()
                    .addComponents([
                        new discord.TextInputComponent()
                            .setCustomId('description')
                            .setLabel('Description')
                            .setPlaceholder('My server description')
                            .setStyle('PARAGRAPH')
                            .setRequired(false),
                    ]),
                new discord.MessageActionRow<discord.TextInputComponent>()
                    .addComponents([
                        new discord.TextInputComponent()
                            .setCustomId('host')
                            .setLabel('Server IP')
                            .setPlaceholder('play.ourmcworld.gq:25565')
                            .setStyle('SHORT')
                            .setRequired(true),
                    ]),
                new discord.MessageActionRow<discord.TextInputComponent>()
                    .addComponents([
                        new discord.TextInputComponent()
                            .setCustomId('script')
                            .setLabel('Server command script')
                            .setPlaceholder('java -jar server.jar')
                            .setStyle('SHORT')
                            .setRequired(true),
                    ]),
                new discord.MessageActionRow<discord.TextInputComponent>()
                    .addComponents([
                        new discord.TextInputComponent()
                            .setCustomId('cwd')
                            .setLabel('Server command working directory')
                            .setPlaceholder('C:\\Users\\User\\Desktop\\server')
                            .setStyle('SHORT')
                            .setRequired(true),
                    ])
            );
        
        this.commands.push(new InteractionCommandBuilder()
            .setName('create-server')
            .setDescription('Create a server')
            .setExecute(async command => {
                const interaction = command.interaction;

                await interaction.showModal(modal);

                const modalSubmit = await interaction.awaitModalSubmit({ time: 60000, filter: c => c.customId == 'kirin-create-server' });
                if (!modalSubmit) return interaction.reply({
                    embeds: [
                        new discord.MessageEmbed()
                            .setDescription('Modal closed')
                            .setColor('RED')
                    ]
                });

                await modalSubmit.deferReply({ ephemeral: true });

                const displayName = modalSubmit.fields.getTextInputValue('display-name');
                const description = modalSubmit.fields.getTextInputValue('description');
                const host = modalSubmit.fields.getTextInputValue('host');
                const script = modalSubmit.fields.getTextInputValue('script');
                const cwd = modalSubmit.fields.getTextInputValue('cwd');

                const message = await interaction.channel?.send({
                    embeds: [
                        new discord.MessageEmbed()
                            .setDescription('Creating server...')
                            .setColor('YELLOW')
                    ]
                }).catch(() => undefined);

                if (!message) return modalSubmit.editReply({
                    embeds: [
                        new discord.MessageEmbed()
                            .setDescription('Failed to send message')
                            .setColor('RED')
                    ]
                });


                const server: KirinServerOptions = {
                    host: host.split(':')[0],
                    port: isNumber(host.split(':')[1]) ? parseInt(host.split(':')[1], 10) : 25565,
                    script: script,
                    scriptRootDir: cwd,
                    displayName,
                    description,
                    channelId: interaction.channelId,
                    messageId: message.id,
                    useMenu: false
                };

                const kirinServers = yml.stringify([...KirinModule.getServers(), server]);
                fs.writeFileSync(path.join(process.cwd(), 'config/Kirin/servers.yml'), kirinServers);

                await this.kirin.parseServers();
                await modalSubmit.editReply({
                    embeds: [
                        new discord.MessageEmbed()
                            .setDescription('Server created')
                            .setColor('GREEN')
                    ]
                });
            })
        )
    }

    public findServer(server: string) {
        return this.kirin.servers.find(s => s.id === server.toLowerCase() || s.config.displayName.toLowerCase() === server.toLowerCase());
    }

    public static getConfig() {
        const configPath = path.join(process.cwd(), 'config/Kirin/commands.yml');
        const defaultConfig: KirinCommandsConfig = {
            start: true,
            stop: true,
            restart: true,
            createServer: true,
        };

        if (!fs.existsSync(configPath)) {
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
            fs.writeFileSync(configPath, yml.stringify(defaultConfig, null, 4));
            return defaultConfig;
        }

        return yml.parse(fs.readFileSync(configPath, 'utf8')) as KirinCommandsConfig;
    }
}

module.exports = new KirinModuleCommands();