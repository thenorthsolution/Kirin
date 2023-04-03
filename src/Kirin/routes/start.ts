import { APIClient } from '../classes/APIClient.js';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/servers';

    api.express.post(apiPath + '/start/:serverId', async (req, res) => api
        .createRequestHandler(req, res)
        .handle(async requestHandler => {
            const serverId = req.params.serverId;
            const server = api.kirin.servers.cache.get(serverId);

            if (!server) return requestHandler.sendAPIErrorResponse(404, { error: 'ServerNotFound', id: serverId });

            await server.start();

            requestHandler.sendAPIResponse({ type: 'ServerStarting', server: server.toJSON() });
        })
    )
}
