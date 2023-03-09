import { APIClient } from '../classes/APIClient.js';
import { Server, ServerData } from '../classes/Server.js';
import type { PartialDeep } from 'type-fest';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/servers';

    api.express.patch(apiPath + '/edit/:serverId', async (req, res) => {
        if (!api.authenticate(req)) return api.errorResponse(res, 401, 'Invalid auth');

        try {
            const data: PartialDeep<ServerData> = JSON.parse(req.body?.data || '{}');

            const serverId = req.params.serverId;
            const server = api.kirin.servers.cache.get(serverId);

            if (!server) return api.errorResponse(res, 404, 'Server not found');

            await server.update(data);

            res.send(server.toJSON());
        } catch (err) {
            return api.errorResponse(res, 400, (err as Error).message);
        }
    });
}
