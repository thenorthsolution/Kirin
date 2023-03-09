import { APIClient } from '../classes/APIClient.js';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/ping';

    api.express.get(apiPath, async (req, res) => {
        if (!api.authenticate(req)) return api.errorResponse(res, 401, 'Invalid auth');
        res.send('Pong!');
    });
}
