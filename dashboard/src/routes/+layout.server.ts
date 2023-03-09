import { isAuthenticated } from '../rest/checkAuth';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getCookie } from '../../../../../../Documents/GitHub/Kirin/dashboard/src/rest/cookie';

export const load = (async ({ route, cookies }) => {
    const authenticated = await isAuthenticated(cookies.get('password'));
    if (!authenticated && route.id !== '/login') throw redirect(307, '/login');
    if (authenticated && route.id == '/login') throw redirect(307, '/');
}) satisfies LayoutServerLoad;
