import { APIClient } from '../classes/APIClient.js';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/send-rcon';

    api.express.post(apiPath + '/:serverId', async (req, res) => api
        .createRequestHandler(req, res)
        .handle(async requestHandler => {
            const serverId = req.params.serverId;
            const server = api.kirin.servers.cache.get(serverId);
            const data: { cmd: string; } = JSON.parse(req.body?.data || '{}');

            if (!server) return requestHandler.sendAPIErrorResponse(404, { error: 'ServerNotFound', id: serverId });
            if (!data.cmd) return requestHandler.sendAPIErrorResponse(400, { error: 'ServerSendRconMissingProperty', missingProperty: 'cmd' });
            if (!server.rconConnected) return requestHandler.sendAPIErrorResponse(400, { error: 'ServerSendRconNotConnected' });

            const response = await server.sendRconData(data.cmd).catch(() => null);
            if (response === null) return requestHandler.sendAPIErrorResponse(400, { error: 'ServerSendRconNoResponse' });

            requestHandler.sendAPIResponse({
                type: 'ServerRconResponse',
                rconResponse: response
            });
        })
    );
}
