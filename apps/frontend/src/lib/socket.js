import { io } from 'socket.io-client';
import { tokens } from './api.js';

const URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

let socket = null;

/**
 * One socket for the whole app. Guests connect without a token and prove their
 * right to a meeting with the join token instead.
 */
export function getSocket() {
  socket ??= io(URL, {
    path: '/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    withCredentials: true,
    auth: (cb) => cb({ token: tokens.access ?? undefined }),
  });
  return socket;
}

export function connectSocket() {
  const instance = getSocket();
  if (!instance.connected) instance.connect();
  return instance;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/** Re-authenticates after sign-in or sign-out so `auth.token` is re-read. */
export function reconnectSocket() {
  if (!socket) return connectSocket();
  socket.disconnect();
  socket.connect();
  return socket;
}
