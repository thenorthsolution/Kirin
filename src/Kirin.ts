import { RecipleClient, RecipleModuleScriptUnloadData } from '@reciple/client';
import { Logger } from 'fallout-utility';
import { AnyCommandBuilder, AnyCommandData, RecipleModule, RecipleModuleScript } from 'reciple';
import { APIClient } from './Kirin/classes/APIClient.js';
import { Config, getConfig } from './Kirin/utils/config.js';

export class Kirin implements RecipleModuleScript {
    readonly versions: string = '^7';
    readonly commands: (AnyCommandBuilder|AnyCommandData)[] = [];
    readonly config: Config = getConfig();

    public logger?: Logger;
    public client!: RecipleClient;
    public apiClient!: APIClient<true>;

    public async onStart(client: RecipleClient<false>, module: RecipleModule): Promise<boolean> {
        this.logger = client.logger?.clone({ name: 'Kirin' });
        this.client = client;
        this.apiClient = new APIClient(this);

        this.logger?.log(`Starting Kirin...`);

        await this.apiClient.start();

        this.logger?.log(`API is now active! http://127.0.0.1:${this.config.apiPort}/api`);

        return true;
    }

    public async onLoad(client: RecipleClient<true>, module: RecipleModule): Promise<void> {}

    public async onUnload(unloadData: RecipleModuleScriptUnloadData): Promise<void> {}
}

export default new Kirin();
