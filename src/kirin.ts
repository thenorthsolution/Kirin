import { RecipleClient, RecipleScript } from 'reciple';
import { Logger } from 'fallout-utility';

export class KirinMain implements RecipleScript {
    public versions: string = '2.0.x';
    public client!: RecipleClient<boolean>;
    public logger!: Logger;
    
    public async onStart(client: RecipleClient<boolean>): Promise<boolean> {
        this.logger = client.logger.cloneLogger({ loggerName: 'Kirin' });
        this.client = client;

        this.logger.log("Starting Kirin...");

        return true;
    }

    public async onLoad(): Promise<void> {
        this.logger.log("Loaded Kirin...");
    }
}

export default new KirinMain();
