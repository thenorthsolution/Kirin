import { APIClient } from '../classes/APIClient.js';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/servers';

    api.express.post(apiPath + '/stop/:serverId', async (req, res) => api
        .createRequestHandler(req, res)
        .handle(async requestHandler => {
            const serverId = req.params.serverId;
            const server = api.kirin.servers.cache.get(serverId);

            if (!server) return requestHandler.sendAPIErrorResponse(404, { error: 'ServerNotFound', id: serverId });

            const stopped = await server.stop();

            if (!stopped) return requestHandler.sendAPIErrorResponse(400, { error: 'ServerStopFailed', server: server.toJSON() });

            requestHandler.sendAPIResponse({ type: 'ServerStopping', server: server.toJSON() });
        })
    )
}
