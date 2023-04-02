import { APIClient } from '../classes/APIClient.js';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/authorize';

    api.express.get(apiPath, async (req, res) => api
        .createRequestHandler(req, res, { authorize: false })
        .handle(async requestHandler => requestHandler.sendAPIResponse({ type: 'Authorize', authorized: requestHandler.isAuthorized() }))
    );

    api.express.get(apiPath, )
}
