import { APIClient } from '../classes/APIClient.js';
import { Server, ServerData } from '../classes/Server.js';
import type { PartialDeep } from 'type-fest';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/servers';

    api.express.patch(apiPath + '/:serverId', async (req, res) => api
        .createRequestHandler(req, res)
        .handle(async requestHandler => {
            try {
                const data: PartialDeep<ServerData> = JSON.parse(req.body?.data || '{}');

                const serverId = req.params.serverId;
                const server = api.kirin.servers.cache.get(serverId);

                if (!server) return requestHandler.sendAPIErrorResponse(404, { error: 'ServerNotFound', id: serverId });

                await server.update(data);

                requestHandler.sendAPIResponse({ type: 'ServerUpdate', server: server.toJSON() });
            } catch (err) {
                return requestHandler.sendAPIErrorResponse(400, { error: 'ServerUpdateFailed', message: err instanceof Error ? err.message : String(err) });
            }
        })
    );
}
