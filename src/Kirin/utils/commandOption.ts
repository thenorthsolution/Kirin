import { SlashCommandSubcommandBuilder } from 'discord.js';
import { SlashCommandBuilder } from 'reciple';

export function serverOption<T extends SlashCommandBuilder|SlashCommandSubcommandBuilder>(builder: T, autocomplete?: boolean): T {
    return builder
        .addStringOption(server => server
            .setName('server')
            .setDescription('Server id')
            .setRequired(true)
            .setAutocomplete(autocomplete !== false)
        ) as T;
}
