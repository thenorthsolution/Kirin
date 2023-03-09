import type { AxiosRequestConfig } from 'axios';
import type { apiPath } from './api';
import axios from 'axios';
import { getCookie } from './cookie';

export type APIRoutes = APIRoutePing;

export type APIRoutePing = `${typeof apiPath}/ping`;

export async function request<T = unknown>(url: APIRoutes, options?: Partial<AxiosRequestConfig<T>>, password?: string): Promise<T> {
    password = (password ?? getCookie('password')) || '';

    return axios({
        ...options,
        headers: {
            password: password || ''
        },
        url
    }).then(e => e.data);
}
