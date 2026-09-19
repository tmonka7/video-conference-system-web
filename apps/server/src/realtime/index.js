import { Server } from 'socket.io';
import { SocketEvent, socketRooms } from '@vcs/shared';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { joinConversationRooms, registerChatHandlers } from './chat.gateway.js';
import { setIo } from './io.js';
import { registerMeetingHandlers } from './meeting.gateway.js';
import { markConnected, markDisconnected } from './presence.js';

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: env.corsOrigins, credentials: true },
    // Signaling payloads are small; nothing here should be megabytes.
    maxHttpBufferSize: 1e6,
    pingTimeout: 25_000,
  });

  /**
   * Guests may connect without a token: they prove their right to a specific
   * meeting later, with the join token issued by POST /meetings/join.
   */
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token ?? socket.handshake.query?.token;

    socket.data.userId = null;
    socket.data.meetingId = null;
    socket.data.participantId = null;
    socket.data.displayName = 'Guest';

    if (token) {
      try {
        socket.data.userId = verifyAccessToken(token).sub;
      } catch {
        // An expired token should not block a guest-style connection.
      }
    }

    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    logger.debug({ socketId: socket.id, userId }, 'Socket connected');

    if (userId) {
      void socket.join(socketRooms.user(userId));
      void markConnected(userId);
      void joinConversationRooms(socket);
    }

    socket.emit(SocketEvent.Connected, { socketId: socket.id, userId });

    registerMeetingHandlers(socket);
    registerChatHandlers(socket);

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'Socket disconnected');
      if (userId) void markDisconnected(userId);
    });
  });

  setIo(io);
  return io;
}
