import { APIClient } from '../classes/APIClient.js';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/servers';

    api.express.delete(apiPath + '/delete/:serverId/:deleteJson?', async (req, res) => {
        if (!api.authenticate(req)) return api.errorResponse(res, 401, 'Invalid auth');

        const serverId = req.params.serverId;
        const deleteJson = req.params.deleteJson === 'true';

        const server = api.kirin.servers.cache.get(serverId);

        if (!server) return api.errorResponse(res, 404, 'Server not found');

        await server.delete(deleteJson);

        res.send(server.toJSON());
    });
}
