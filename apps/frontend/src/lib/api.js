const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const API_PREFIX = '/api/v1';

const ACCESS_KEY = 'vcs.accessToken';
const REFRESH_KEY = 'vcs.refreshToken';

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

  /** The first message for a field, for inline form errors. */
  fieldError(field) {
    return this.details[field]?.[0];
  }
}

export function apiUrl(path) {
  return `${BASE_URL}${API_PREFIX}${path}`;
}

/** Absolute URL for a file the API returned as a relative path. */
export function assetUrl(url) {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${BASE_URL}${url}`;
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

/**
 * Refresh is shared: if several requests hit a 401 at once they all await the
 * same rotation rather than racing and invalidating each other's tokens.
 */
let refreshing = null;

async function refreshTokens() {
  refreshing ??= (async () => {
    const refreshToken = tokens.refresh;
    if (!refreshToken) throw new ApiError(401, 'UNAUTHORIZED', 'Your session has ended');

    const response = await fetch(apiUrl('/auth/refresh'), {
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

async function send(method, path, { body, query, signal, retry = true, formData } = {}) {
  const url = new URL(apiUrl(path));
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = {};
  const accessToken = tokens.access;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    signal,
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (response.status === 401 && retry && tokens.refresh) {
    try {
      await refreshTokens();
    } catch {
      tokens.clear();
      throw new ApiError(401, 'UNAUTHORIZED', 'Your session has ended, please sign in again');
    }
    return send(method, path, { body, query, signal, retry: false, formData });
  }

  return parse(response);
}

export const api = {
  get: (path, options) => send('GET', path, options),
  post: (path, body, options) => send('POST', path, { ...options, body }),
  patch: (path, body, options) => send('PATCH', path, { ...options, body }),
  delete: (path, options) => send('DELETE', path, options),
  upload: (path, formData, options) => send('POST', path, { ...options, formData }),
};

/* ---------------------------------------------------------------- endpoints */

export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  logout: () => api.post('/auth/logout', {}),
  me: () => api.get('/auth/me'),
  changePassword: (payload) => api.post('/auth/change-password', payload),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
};

export const usersApi = {
  updateProfile: (payload) => api.patch('/users/me', payload),
  updateSettings: (payload) => api.patch('/users/me/settings', payload),
  search: (query) => api.get('/users', { query }),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.upload('/users/me/avatar', form);
  },
};

export const meetingsApi = {
  list: (query) => api.get('/meetings', { query }),
  get: (id) => api.get(`/meetings/${id}`),
  create: (payload) => api.post('/meetings', payload),
  update: (id, payload) => api.patch(`/meetings/${id}`, payload),
  remove: (id) => api.delete(`/meetings/${id}`),
  instant: (payload = {}) => api.post('/meetings/instant', payload),
  join: (payload) => api.post('/meetings/join', payload),
  lookup: (code) => api.get(`/meetings/lookup/${code}`),
  end: (id) => api.post(`/meetings/${id}/end`, {}),
  cancel: (id) => api.post(`/meetings/${id}/cancel`, {}),
  invite: (id, inviteeIds) => api.post(`/meetings/${id}/invite`, { inviteeIds }),
  participants: (id) => api.get(`/meetings/${id}/participants`),
  removeParticipant: (id, participantId) =>
    api.delete(`/meetings/${id}/participants/${participantId}`),
};

export const contactsApi = {
  list: (query) => api.get('/contacts', { query }),
  add: (identifier) => api.post('/contacts', { identifier }),
  accept: (id) => api.post(`/contacts/${id}/accept`, {}),
  block: (id) => api.post(`/contacts/${id}/block`, {}),
  favorite: (id, favorite) => api.patch(`/contacts/${id}/favorite`, { favorite }),
  remove: (id) => api.delete(`/contacts/${id}`),
};

export const chatApi = {
  conversations: (query) => api.get('/chat/conversations', { query }),
  conversation: (id) => api.get(`/chat/conversations/${id}`),
  createConversation: (payload) => api.post('/chat/conversations', payload),
  messages: (id, query) => api.get(`/chat/conversations/${id}/messages`, { query }),
  send: (id, payload) => api.post(`/chat/conversations/${id}/messages`, payload),
  markRead: (id, messageId) => api.post(`/chat/conversations/${id}/read`, { messageId }),
};

export const filesApi = {
  list: (query) => api.get('/files', { query }),
  remove: (id) => api.delete(`/files/${id}`),
  upload: (file, context = {}) => {
    const form = new FormData();
    form.append('file', file);
    if (context.meetingId) form.append('meetingId', context.meetingId);
    if (context.conversationId) form.append('conversationId', context.conversationId);
    return api.upload('/files', form);
  },
};
