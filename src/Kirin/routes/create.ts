import { APIClient } from '../classes/APIClient.js';
import { ServerData } from '../classes/Server.js';

export default (api: APIClient) => {
    const apiPath = api.apiPath + '/servers';

    api.express.post(apiPath + '/create', async (req, res) => {
        if (!api.authenticate(req)) return api.errorResponse(res, 401, 'Invalid auth');

        const data: ServerData = req.body;

        res.send(data);
    });
}
