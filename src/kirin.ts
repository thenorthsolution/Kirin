import { MessageCommandBuilder, RecipleClient, RecipleCommandBuilders, RecipleScript } from 'reciple';
import { Config, KirinConfig } from './Kirin/Config';
import { Logger, replaceAll } from 'fallout-utility';
import { Server } from './Kirin/Server';

export class KirinMain implements RecipleScript {
    public versions: string = '2.0.x';
    public config: KirinConfig = Config.getConfig();
    public client!: RecipleClient<boolean>;
    public logger!: Logger;
    public servers: Server[] = [];
    public commands?: RecipleCommandBuilders[] = [];
    
    public async onStart(client: RecipleClient<boolean>): Promise<boolean> {
        this.logger = client.logger.cloneLogger({ loggerName: 'Kirin' });
        this.client = client;

        this.logger.log("Starting Kirin...");

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

    public getMessage<T extends any>(message: string, defaultMessage?: T, ...placeholders: string[]): T {
        let msg = this.config.messages[message] ?? defaultMessage ?? message;

        let id = 0;
        for (const placeholder of placeholders) {
            msg = replaceAll(msg, `{${id}}`, placeholder);
            id++;
        }

        return msg as T;
    }
}

export default new KirinMain();
