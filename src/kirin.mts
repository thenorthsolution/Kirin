import { RecipleClient, RecipleModuleScriptUnloadData } from '@reciple/client';
import { Collection } from 'discord.js';
import { Logger } from 'fallout-utility';
import { RecipleModule, RecipleModuleScript } from 'reciple';
import { Server } from './Kirin/classes/Server.mjs';
import { KirinConfig, createConfig } from './Kirin/utils/config.mjs';
import { ServerConfig, createServersConfig } from './Kirin/utils/serversConfig.mjs';

export class KirinModule implements RecipleModuleScript {
    public client!: RecipleClient;
    public logger?: Logger;

    readonly versions: string[] = ['^7.0.9'];
    readonly servers: Collection<string, Server> = new Collection();

    public config: KirinConfig = createConfig();
    public serversConfig: ServerConfig[] = createServersConfig();

    public async onStart(client: RecipleClient<false>, module: RecipleModule): Promise<boolean> {
        this.client = client;
        this.logger = client.logger?.clone({ name: 'Kirin' });

        this.logger?.log(`Starting Kirin...`);



        return true;
    }

    public async onLoad(client: RecipleClient<true>, module: RecipleModule): Promise<void> {}

    public async onUnload(unloadData: RecipleModuleScriptUnloadData): Promise<void> {
        this.logger?.log(`Stopping attached servers...`);
        this.logger?.log(`Unloaded Kirin!`);
    }
}
