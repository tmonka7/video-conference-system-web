import { ConversationType, SocketEvent } from '@vcs/shared';
import { emitToConversation } from '../../realtime/io.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, noContent, ok } from '../../utils/response.js';
import * as chatService from './chat.service.js';

export const listConversations = asyncHandler(async (req, res) => {
  ok(res, await chatService.listConversations(req.user._id.toString(), req.query));
});

export const createConversation = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { type, participantIds, title } = req.body;

  if (type === ConversationType.Direct) {
    const other = participantIds.find((id) => id !== userId);
    if (!other) throw ApiError.badRequest('Choose someone to chat with');
    created(res, await chatService.getOrCreateDirectConversation(userId, other));
    return;
  }

  created(res, await chatService.createGroupConversation(userId, participantIds, title));
});

export const getConversation = asyncHandler(async (req, res) => {
  ok(res, await chatService.getConversation(req.params.id, req.user._id.toString()));
});

export const listMessages = asyncHandler(async (req, res) => {
  ok(res, await chatService.listMessages(req.params.id, req.user._id.toString(), req.query));
});

export const sendMessage = asyncHandler(async (req, res) => {
  const message = await chatService.sendMessage(req.params.id, req.user._id.toString(), req.body);

  // Anyone with the thread open sees it without polling.
  emitToConversation(req.params.id, SocketEvent.ChatMessage, { message });
  created(res, message);
});

export const markRead = asyncHandler(async (req, res) => {
  await chatService.markRead(req.params.id, req.user._id.toString(), req.body?.messageId);
  noContent(res);
});
