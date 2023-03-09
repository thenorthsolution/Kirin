import { APIClient } from '../classes/APIClient.js';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/servers';

    api.express.get(apiPath, async (req, res) => {
        if (!api.authenticate(req)) return api.errorResponse(res, 401, 'Invalid auth');

        const servers = api.kirin.servers.cache.map(s => s.toJSON());

        res.send(servers);
    });

    api.express.get(apiPath + '/:serverId', async (req, res) => {
        if (!api.authenticate(req)) return api.errorResponse(res, 401, 'Invalid auth');

        const serverId = req.params.serverId;
        const server = api.kirin.servers.cache.get(serverId);

        if (!server) return api.errorResponse(res, 404, 'Server not found');

        res.send(server.toJSON())
    });
}
