import { RecipleClient } from '@reciple/client';
import { Logger } from 'fallout-utility';
import { RecipleModule, RecipleModuleScript } from 'reciple';

export class KirinModule implements RecipleModuleScript {
    public client!: RecipleClient;
    public logger?: Logger;

    readonly versions: string[] = ['^7.0.9'];

    public async onStart(client: RecipleClient<false>, module: RecipleModule): Promise<boolean> {
        this.client = client;
        this.logger = client.logger?.clone({ name: 'Kirin' });

        return true;
    }
}
