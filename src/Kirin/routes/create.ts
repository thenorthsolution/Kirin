import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { APIClient } from '../classes/APIClient.js';
import { Server, ServerData } from '../classes/Server.js';
import crypto from 'crypto';
import path from 'path';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/servers';

    api.express.post(apiPath + '/create', (req, res) => api
        .createRequestHandler(req, res)
        .handle(async requestHandler => {
            try {
                const data: ServerData = JSON.parse(req.body?.data || '{}');

                Server.validateServerData(data);

                const file = path.join(api.kirin.serversDir, crypto.randomBytes(10).toString('base64url') + '.json');

                mkdirSync(api.kirin.serversDir, { recursive: true });
                writeFileSync(file, JSON.stringify(data, null, 2));

                const server = await Server.from(file, api.kirin, true).catch(() => null);

                if (!server) {
                    rmSync(file, { force: true });
                    return requestHandler.sendAPIErrorResponse(400, { error: 'ServerCreateFailed', message: 'Unable to resolve server data' });
                }

                res.send(server.toJSON());
            } catch (err) {
                return requestHandler.sendAPIErrorResponse(400, { error: 'ServerCreateFailed', message: err instanceof Error ? err.message : String(err) });
            }
        })
    );
}
