import { ChildProcess } from 'child_process';
import { KirinModule } from '../../kirin.mjs';

export interface ServerOptions {
    kirin: KirinModule;
}

export class Server {
    readonly kirin: KirinModule;

    public process?: ChildProcess;

    constructor(readonly options: ServerOptions) {
        this.kirin = options.kirin;
    }
}
