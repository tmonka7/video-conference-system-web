import { ErrorCode, SocketEvent, socketRooms } from '@vcs/shared';
import { logger } from '../config/logger.js';
import { Meeting } from '../models/Meeting.js';
import * as chatService from '../modules/chat/chat.service.js';
import { ApiError } from '../utils/ApiError.js';

function fail(socket, code, message, event) {
  socket.emit(SocketEvent.Error, { code, message, event });
}

/**
 * In-meeting chat writes to the conversation attached to the meeting, so the
 * transcript survives after everyone leaves.
 */
async function resolveConversationId(socket, payload) {
  if (payload?.conversationId) return payload.conversationId;

  const meetingId = payload?.meetingId ?? socket.data.meetingId;
  if (!meetingId) return null;

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) return null;
  if (!meeting.settings.allowChat) {
    fail(socket, ErrorCode.Forbidden, 'Chat is disabled for this meeting', SocketEvent.ChatSend);
    return null;
  }

  const memberIds = meeting.participants
    .filter((participant) => participant.user)
    .map((participant) => participant.user.toString());

  const conversation = await chatService.ensureMeetingConversation(
    meeting._id.toString(),
    meeting.title,
    [meeting.host.toString(), ...memberIds],
  );

  return conversation._id.toString();
}

async function handleSend(socket, payload) {
  const userId = socket.data.userId;
  if (!userId) {
    fail(socket, ErrorCode.Unauthorized, 'Sign in to send messages', SocketEvent.ChatSend);
    return;
  }

  const conversationId = await resolveConversationId(socket, payload);
  if (!conversationId) {
    fail(socket, ErrorCode.NotFound, 'That conversation could not be found', SocketEvent.ChatSend);
    return;
  }

  const message = await chatService.sendMessage(conversationId, userId, {
    body: payload.body,
    attachmentIds: payload.attachmentIds,
  });

  socket.nsp
    .to(socketRooms.conversation(conversationId))
    .emit(SocketEvent.ChatMessage, { message });

  // In-meeting chat also reaches guests, who are in the meeting room only.
  if (socket.data.meetingId) {
    socket.nsp
      .to(socketRooms.meeting(socket.data.meetingId))
      .emit(SocketEvent.ChatMessage, { message });
  }
}

async function handleTyping(socket, payload) {
  const userId = socket.data.userId;
  if (!userId) return;

  await chatService.assertMember(payload.conversationId, userId);
  socket.to(socketRooms.conversation(payload.conversationId)).emit(SocketEvent.ChatTypingUpdate, {
    ...payload,
    userId,
    name: socket.data.displayName,
  });
}

async function handleRead(socket, payload) {
  const userId = socket.data.userId;
  if (!userId) return;
  await chatService.markRead(payload.conversationId, userId, payload.messageId);
}

/** Subscribes the socket to every conversation the user belongs to. */
export async function joinConversationRooms(socket) {
  const userId = socket.data.userId;
  if (!userId) return;

  const conversations = await chatService.listConversations(userId, { limit: 100 });
  await Promise.all(
    conversations.items.map((conversation) =>
      socket.join(socketRooms.conversation(conversation.id)),
    ),
  );
}

export function registerChatHandlers(socket) {
  const guard = (handler, event) => (payload) => {
    Promise.resolve(handler(payload)).catch((error) => {
      const isKnown = error instanceof ApiError;
      if (!isKnown) {
        logger.error({ err: error, event, socketId: socket.id }, 'Chat handler failed');
      }
      fail(
        socket,
        isKnown ? error.code : ErrorCode.Internal,
        isKnown ? error.message : 'Your message could not be delivered',
        event,
      );
    });
  };

  socket.on(
    SocketEvent.ChatSend,
    guard((payload) => handleSend(socket, payload), SocketEvent.ChatSend),
  );
  socket.on(
    SocketEvent.ChatTyping,
    guard((payload) => handleTyping(socket, payload), SocketEvent.ChatTyping),
  );
  socket.on(
    SocketEvent.ChatRead,
    guard((payload) => handleRead(socket, payload), SocketEvent.ChatRead),
  );
}
