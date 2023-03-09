import { request } from './routes';
export async function isAuthenticated(password?: string): Promise<boolean> {
    const ping = await request('http://localhost:55667/api/ping', { method: 'GET' }, password).catch(() => null);
    return !!ping;
}
