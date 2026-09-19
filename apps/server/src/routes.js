import express from 'express';
import mongoose from 'mongoose';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { chatRouter } from './modules/chat/chat.routes.js';
import { contactsRouter } from './modules/contacts/contacts.routes.js';
import { filesRouter } from './modules/files/files.routes.js';
import { meetingsRouter } from './modules/meetings/meetings.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { ok } from './utils/response.js';

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export const apiRouter = express.Router();

apiRouter.get('/health', (_req, res) => {
  ok(res, {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    database: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/meetings', meetingsRouter);
apiRouter.use('/contacts', contactsRouter);
apiRouter.use('/chat', chatRouter);
apiRouter.use('/files', filesRouter);
apiRouter.use('/admin', adminRouter);
