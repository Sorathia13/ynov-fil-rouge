import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? '/api';

export const api = axios.create({ baseURL, withCredentials: true });

const ACCESS_KEY = 'sb_access';
let accessToken: string | null = localStorage.getItem(ACCESS_KEY);

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) localStorage.setItem(ACCESS_KEY, token);
  else localStorage.removeItem(ACCESS_KEY);
}

export function getAccessToken(): string | null {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Silent refresh: on a 401 we try the refresh cookie once, then replay the request.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
    const token = res.data.accessToken as string;
    setAccessToken(token);
    return token;
  } catch {
    setAccessToken(null);
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/auth/');
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccessToken();
      const token = await refreshing;
      refreshing = null;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

/** Extract a human-readable message (and optional details) from an API error. */
export function apiError(error: unknown): { message: string; code?: string; details?: unknown } {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as
      | { error?: { code?: string; message?: string; details?: unknown } }
      | undefined;
    if (body?.error) {
      return { message: body.error.message ?? 'Une erreur est survenue', code: body.error.code, details: body.error.details };
    }
    return { message: error.message };
  }
  return { message: 'Une erreur inattendue est survenue' };
}
