import { CommandHaltReason, SlashCommandHaltData } from 'reciple';
import Kirin from '../../Kirin.js';

export async function commandHalt(data: SlashCommandHaltData): Promise<boolean> {
    if (data.reason === CommandHaltReason.Error) {
        Kirin.logger?.error(`An error occured while executing command: ${data.executeData.builder.name}\n`, data.error);
        return true;
    }

    return false;
}
