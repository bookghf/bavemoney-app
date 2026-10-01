import {
  create,
  isAxiosError,
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import type { AuthResponse } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth-store';

/**
 * Base URL of the Ledger API, from EXPO_PUBLIC_API_URL (see .env.example).
 * The default works for web and the iOS simulator on the same machine.
 * - Android emulator: use http://10.0.2.2:8080/api/v1 (the emulator's alias for the host).
 * - Physical device: use your machine's LAN IP, e.g. http://192.168.1.20:8080/api/v1.
 * EXPO_PUBLIC_* vars are inlined at bundle time; restart Metro after changing them.
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
).replace(/\/+$/, '');

const baseConfig = {
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
};

export const api: AxiosInstance = create(baseConfig);

/** Client used only for token refresh; it has no auth/refresh interceptors, so it can never recurse. */
const refreshClient: AxiosInstance = create(baseConfig);

// --- request/response logging (dev builds only) -----------------------------

/** Values that would leak credentials into the console are masked before logging. */
const SECRET_KEYS = ['password', 'refresh_token', 'access_token', 'token'];

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, SECRET_KEYS.includes(key) ? '***' : redact(inner)]),
    );
  }
  return value;
}

/** Request bodies arrive already serialized to a JSON string by the time interceptors run. */
function parseBody(data: unknown): unknown {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

/** When the request left, so the response log can show how long it took. */
type TimedConfig = InternalAxiosRequestConfig & { metadata?: { startTime: number } };

function elapsed(config: TimedConfig | undefined): number | undefined {
  const startTime = config?.metadata?.startTime;
  return startTime === undefined ? undefined : Date.now() - startTime;
}

/** Headers for the log, with the bearer token shortened to its last characters. */
function loggedHeaders(config: InternalAxiosRequestConfig): Record<string, unknown> {
  const headers = { ...config.headers.toJSON() } as Record<string, unknown>;
  if (typeof headers.Authorization === 'string') {
    // Every JWT starts with the same header, so keep the end to tell tokens apart.
    headers.Authorization = headers.Authorization.replace(/^Bearer .*(.{6})$/, 'Bearer …$1');
  }
  return headers;
}

/**
 * Full request URL including query params (?page=2&limit=20...). axios keeps
 * params out of config.url, so baseURL + url alone would hide them.
 */
function fullUrl(config: InternalAxiosRequestConfig | undefined): string {
  return config ? api.getUri(config) : '';
}

function logRequest(config: TimedConfig) {
  config.metadata = { startTime: Date.now() };
  console.log(
    `Request [${config.method}] ===> ${fullUrl(config)} \nHeader: ${JSON.stringify(loggedHeaders(config), null, 2)} \n Body: ${JSON.stringify(redact(parseBody(config.data)), null, 2)}`,
  );
}

function logResponse(response: AxiosResponse) {
  const responseTime = elapsed(response.config);
  console.log(
    `Response [${response.status}] (${responseTime ?? '?'}ms) <=== ${fullUrl(response.config)} \n Data: ${JSON.stringify(redact(response?.data), null, 2)}`,
  );
}

function logError(error: AxiosError) {
  const responseTime = elapsed(error.config);
  if (error.response) {
    console.log(
      `Error [${error.status}] (${responseTime ?? '?'}ms) <=== ${fullUrl(error.response.config)}\ndata: ${JSON.stringify(redact(error.response.data), null, 2)}`,
    );
  } else {
    // No response at all: offline, timeout, or the API is down.
    console.log(
      `Error [${error.code ?? 'NETWORK'}] (${responseTime ?? '?'}ms) <=== ${fullUrl(error.config)}\ndata: ${JSON.stringify(error.message)}`,
    );
  }
}

/**
 * Logs every request (method, URL, headers, body) and every response or error
 * (status, time taken, URL, body), with passwords and tokens masked. Call this before adding other interceptors: axios runs
 * request interceptors last-added-first, so this one then sees the final
 * headers (including Authorization), and response interceptors first-added-first,
 * so it sees the raw 401 before a refresh retry.
 */
function attachLogger(client: AxiosInstance) {
  if (!__DEV__) return;
  client.interceptors.request.use((config) => {
    logRequest(config);
    return config;
  });
  client.interceptors.response.use(
    (response) => {
      logResponse(response);
      return response;
    },
    (error: AxiosError) => {
      logError(error);
      return Promise.reject(error);
    },
  );
}

attachLogger(api);
attachLogger(refreshClient);

/** Auth endpoints never carry/refresh a bearer token; a 401 there is a real failure. */
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

function isAuthEndpoint(url: string | undefined) {
  return !!url && AUTH_PATHS.some((path) => url.endsWith(path));
}

/**
 * Normalize an auth envelope. The API spec calls the access token `token`,
 * but some server builds emit `access_token`; accept either.
 */
export function normalizeAuthResponse(data: AuthResponse & { access_token?: string }): AuthResponse {
  return { ...data, token: data.token ?? data.access_token ?? '' };
}

// Attach the access token at request time. Reading via getState() keeps this
// out of React's render cycle.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token && !isAuthEndpoint(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- refresh (single-flight) ----------------------------------------------

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Exchange the stored refresh token for a new session. Concurrent callers share
 * one request, which matters because refresh tokens rotate: a second request
 * with the same token would be rejected and log the user out.
 *
 * Resolves to the new access token, or null when there is no session / the
 * server rejected the refresh token (in which case the user is signed out).
 * Network errors are re-thrown without signing out.
 */
export function refreshSession(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const { refreshToken, setSession, signOut } = useAuthStore.getState();
      if (!refreshToken) return null;
      try {
        const { data } = await refreshClient.post<AuthResponse>('/auth/refresh', {
          refresh_token: refreshToken,
        });
        const session = normalizeAuthResponse(data);
        // Ignore the result if the user signed out while we were waiting.
        if (useAuthStore.getState().refreshToken !== refreshToken) return null;
        await setSession(session);
        return session.token;
      } catch (error) {
        const status = (error as AxiosError).response?.status;
        // 403: the account was suspended.
        if (status === 400 || status === 401 || status === 403) {
          await signOut();
          return null;
        }
        throw error;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    if (error.response?.status !== 401 || !original || original._retried || isAuthEndpoint(original.url)) {
      return Promise.reject(error);
    }
    original._retried = true;

    // Another request may already have refreshed while this one was in flight.
    const sentToken = String(original.headers.Authorization ?? '').replace(/^Bearer /, '');
    const current = useAuthStore.getState().accessToken;
    let token: string | null = current && current !== sentToken ? current : null;

    if (!token) {
      try {
        token = await refreshSession();
      } catch {
        return Promise.reject(error);
      }
    }
    if (!token) return Promise.reject(error);

    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  },
);

/** Human-readable message from an API error (`{"error": "..."}`) or network failure. */
export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const body = error.response?.data as { error?: string; message?: string } | undefined;
    // Server messages are English; known ones are translated.
    if (body?.error) return t(body.error);
    if (body?.message) return t(body.message);
    if (error.response?.status === 429) return t('Too many attempts. Wait a minute and try again.');
    if (error.response) return t('Request failed ({status})', { status: error.response.status });
    if (error.code === 'ECONNABORTED') return t('Request timed out');
    return t('Cannot reach the server. Check your connection.');
  }
  if (error instanceof Error) return error.message;
  return t('Something went wrong');
}
