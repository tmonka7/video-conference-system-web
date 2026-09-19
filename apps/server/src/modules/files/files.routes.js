import express from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { objectIdParam } from '../users/users.schema.js';
import * as controller from './files.controller.js';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid identifier');

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.string().max(60).optional(),
  meetingId: objectId.optional(),
  conversationId: objectId.optional(),
});

export const filesRouter = express.Router();

filesRouter.use(authenticate);

filesRouter.post('/', uploadLimiter, upload.single('file'), controller.uploadFile);
filesRouter.get('/', validate({ query: listQuerySchema }), controller.list);
filesRouter.get('/:id', validate({ params: objectIdParam }), controller.getOne);
filesRouter.get('/:id/download', validate({ params: objectIdParam }), controller.download);
filesRouter.delete('/:id', validate({ params: objectIdParam }), controller.remove);
