import { RecipleClient, RecipleModuleScriptUnloadData } from '@reciple/client';
import { Logger } from 'fallout-utility';
import { AnyCommandBuilder, AnyCommandData, RecipleModule, RecipleModuleScript, cwd } from 'reciple';
import { APIClient } from './Kirin/classes/APIClient.js';
import { Config, getConfig } from './Kirin/utils/config.js';
import { ServerManager } from './Kirin/classes/ServerManager.js';
import path from 'path';

export class Kirin implements RecipleModuleScript {
    readonly versions: string = '^7';
    readonly commands: (AnyCommandBuilder|AnyCommandData)[] = [];
    readonly config: Config = getConfig();

    public logger?: Logger;
    public client!: RecipleClient;
    public apiClient!: APIClient<true>;
    public servers!: ServerManager;

    public async onStart(client: RecipleClient<false>, module: RecipleModule): Promise<boolean> {
        this.logger = client.logger?.clone({ name: 'Kirin' });
        this.client = client;
        this.apiClient = new APIClient(this);
        this.servers = new ServerManager(this);

        this.logger?.log(`Starting Kirin...`);
        return true;
    }

    public async onLoad(client: RecipleClient<true>, module: RecipleModule): Promise<void> {
        this.servers.mountRoutes();

        await this.apiClient.start();

        this.logger?.log(`Kirin is now active! http://127.0.0.1:${this.config.apiPort}`);

        await this.servers.loadServersFromDir(path.join(cwd, this.config.serversFolders))
    }

    public async onUnload(unloadData: RecipleModuleScriptUnloadData): Promise<void> {}
}

export default new Kirin();
