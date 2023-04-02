import { APIClient } from '../classes/APIClient.js';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/ping';

    api.express.get(apiPath, async (req, res) => api
        .createRequestHandler(req, res, { authorize: false })
        .handle(async requestHandler => requestHandler.sendAPIResponse({ type: 'Ping', message: 'Pong!' }))
    );

    api.express.get(apiPath, )
}
