const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const API_PREFIX = '/api/v1';

const ACCESS_KEY = 'vcs.admin.accessToken';
const REFRESH_KEY = 'vcs.admin.refreshToken';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set({ accessToken, refreshToken }) {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details ?? {};
  }
}

async function parse(response) {
  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);
  if (response.ok) return payload?.data ?? null;

  const error = payload?.error ?? {};
  throw new ApiError(
    response.status,
    error.code ?? 'INTERNAL_ERROR',
    error.message ?? 'Something went wrong',
    error.details,
  );
}

let refreshing = null;

async function refreshTokens() {
  refreshing ??= (async () => {
    const refreshToken = tokens.refresh;
    if (!refreshToken) throw new ApiError(401, 'UNAUTHORIZED', 'Your session has ended');

    const response = await fetch(`${BASE_URL}${API_PREFIX}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    });

    const data = await parse(response);
    tokens.set(data.tokens);
    return data;
  })().finally(() => {
    refreshing = null;
  });

  return refreshing;
}

async function send(method, path, { body, query, retry = true } = {}) {
  const url = new URL(`${BASE_URL}${API_PREFIX}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = {};
  if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && retry && tokens.refresh) {
    try {
      await refreshTokens();
    } catch {
      tokens.clear();
      throw new ApiError(401, 'UNAUTHORIZED', 'Your session has ended, please sign in again');
    }
    return send(method, path, { body, query, retry: false });
  }

  return parse(response);
}

export const api = {
  get: (path, options) => send('GET', path, options),
  post: (path, body) => send('POST', path, { body }),
  patch: (path, body) => send('PATCH', path, { body }),
  delete: (path) => send('DELETE', path),
};

export const authApi = {
  login: (payload) => api.post('/auth/login', payload),
  logout: () => api.post('/auth/logout', {}),
  me: () => api.get('/auth/me'),
};

export const adminApi = {
  overview: (days = 7) => api.get('/admin/overview', { query: { days } }),
  users: (query) => api.get('/admin/users', { query }),
  createUser: (payload) => api.post('/admin/users', payload),
  updateUser: (id, payload) => api.patch(`/admin/users/${id}`, payload),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  meetings: (query) => api.get('/admin/meetings', { query }),
  endMeeting: (id) => api.post(`/admin/meetings/${id}/end`, {}),
  auditLogs: (query) => api.get('/admin/audit-logs', { query }),
};
