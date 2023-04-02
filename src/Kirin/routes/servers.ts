import { APIClient } from '../classes/APIClient.js';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/servers';

    api.express.get(apiPath, async (req, res) => api
        .createRequestHandler(req, res)
        .handle(async requestHandler => {
            const servers = api.kirin.servers.cache.map(s => s.toJSON());

            requestHandler.sendAPIResponse({ type: 'Servers', servers });
        })
    );

    api.express.get(apiPath + '/:serverId', async (req, res) => api
        .createRequestHandler(req, res)
        .handle(async requestHandler => {
            const serverId = req.params.serverId;
            const server = api.kirin.servers.cache.get(serverId);

            if (!server) return requestHandler.sendAPIErrorResponse(404, { error: 'ServerNotFound', id: serverId });

            requestHandler.sendAPIResponse({ type: 'Server', server: server.toJSON() })
        })
    );
}
