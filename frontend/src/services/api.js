import axios from 'axios';

export const AUTH_EXPIRED_EVENT = 'tammewar:auth-expired';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBase = configuredApiBase || (import.meta.env.DEV ? '/api' : '');

if (!apiBase) {
  throw new Error('VITE_API_BASE_URL must be configured for production builds');
}

let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = typeof token === 'string' && token ? token : null;
};

export const clearAccessToken = () => {
  accessToken = null;
};

const api = axios.create({
  baseURL: apiBase,
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAccessToken();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

export default api;
