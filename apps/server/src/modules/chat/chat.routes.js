import express from 'express';
import { z } from 'zod';
import { ConversationType, MessageType, valuesOf } from '@vcs/shared';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { objectIdParam } from '../users/users.schema.js';
import * as controller from './chat.controller.js';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid identifier');

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(120).optional(),
});

const messagesQuerySchema = listQuerySchema.extend({
  before: z.string().datetime().optional(),
});

const createConversationSchema = z.object({
  type: z.enum(valuesOf(ConversationType)).default(ConversationType.Direct),
  participantIds: z.array(objectId).min(1).max(100),
  title: z.string().trim().min(1).max(160).optional(),
});

const sendMessageSchema = z.object({
  body: z.string().max(8000).default(''),
  type: z.enum(valuesOf(MessageType)).optional(),
  attachmentIds: z.array(objectId).max(5).optional(),
});

const markReadSchema = z.object({ messageId: objectId.optional() });

export const chatRouter = express.Router();

chatRouter.use(authenticate);

chatRouter.get(
  '/conversations',
  validate({ query: listQuerySchema }),
  controller.listConversations,
);
chatRouter.post(
  '/conversations',
  validate({ body: createConversationSchema }),
  controller.createConversation,
);
chatRouter.get('/conversations/:id', validate({ params: objectIdParam }), controller.getConversation);
chatRouter.get(
  '/conversations/:id/messages',
  validate({ params: objectIdParam, query: messagesQuerySchema }),
  controller.listMessages,
);
chatRouter.post(
  '/conversations/:id/messages',
  validate({ params: objectIdParam, body: sendMessageSchema }),
  controller.sendMessage,
);
chatRouter.post(
  '/conversations/:id/read',
  validate({ params: objectIdParam, body: markReadSchema }),
  controller.markRead,
);
