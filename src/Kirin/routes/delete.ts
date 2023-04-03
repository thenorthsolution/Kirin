import { APIClient } from '../classes/APIClient.js';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/servers';

    api.express.delete(apiPath + '/:serverId/:deleteJson?', (req, res) => api
        .createRequestHandler(req, res)
        .handle(async requestHandler => {
            const serverId = req.params.serverId;
            const deleteJson = req.params.deleteJson === 'true';

            const server = api.kirin.servers.cache.get(serverId);

            if (!server) return requestHandler.sendAPIErrorResponse(404, { error: 'ServerNotFound', id: serverId });

            await server.delete(deleteJson);

            requestHandler.sendAPIResponse({ type: 'ServerDelete', server: server.toJSON() });
        })
    );
}
