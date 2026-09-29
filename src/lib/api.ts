import type { ApiEnvelope, PaginatedMeta } from '../types';

const TOKEN_KEY = 'milams.token';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: { path: string; message: string }[];

  constructor(status: number, code: string, message: string, fieldErrors: { path: string; message: string }[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  /** True when the session is simply over, so the app should return to sign-in. */
  get isAuthFailure(): boolean {
    return this.status === 401;
  }
}

export const tokenStore = {
  get: (): string | null => {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      // Private browsing modes can throw on access; treat that as "no session".
      return null;
    }
  },
  set: (token: string): void => {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable - the in-memory request header still works */
    }
  },
  clear: (): void => {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing to do */
    }
  },
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
};

/**
 * Serialises only the query parameters that are actually set. The server treats
 * an absent filter as "no filter", whereas `?baseId=` would arrive as an empty
 * string and fail validation.
 */
function buildQuery(query: RequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

let onUnauthorized: (() => void) | null = null;

/** Registered by the auth provider so an expired token bounces to sign-in once. */
export function registerUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { method = 'GET', body, query, signal } = options;
  const token = tokenStore.get();

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

    const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check that the API is running.');
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const envelope = payload as { error?: { code?: string; message?: string; details?: { path: string; message: string }[] } } | null;
    const error = envelope?.error;
    // 401 is expected on the sign-in form itself, so only trigger the global
    // handler for endpoints the user was actually signed in to call.
    if (response.status === 401 && path !== '/auth/login' && onUnauthorized) onUnauthorized();
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? `Request failed with status ${response.status}.`,
      error?.details ?? [],
    );
  }

  return (payload ?? { data: null }) as ApiEnvelope<T>;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/**
 * Unwraps the rows from a list query result.
 *
 * The API returns `{ data, meta }` in one envelope, and the pagination totals
 * live in `meta`, so a raw query result holds the whole envelope. These two
 * helpers keep access honest: `rowsOf` is always `T[]` and `dataOf` is always
 * the single resource, so neither can be mistaken for the envelope.
 */
export function rowsOf<T>(result: { data?: ApiEnvelope<T[]> } | undefined): T[] {
  return result?.data?.data ?? [];
}

/** Unwraps a single-resource response. */
export function dataOf<T>(result: { data?: ApiEnvelope<T> } | undefined): T | undefined {
  return result?.data?.data;
}

/** Same idea for the pagination/summary metadata. */
export function metaOf<T>(result: { data?: ApiEnvelope<T> } | undefined): PaginatedMeta {
  return (result?.data?.meta ?? {}) as PaginatedMeta;
}
