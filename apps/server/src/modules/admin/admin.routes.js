import express from 'express';
import { z } from 'zod';
import { UserRole, UserStatus, valuesOf } from '@vcs/shared';
import { authenticate, requireAdmin, requireSuperAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { emailSchema, passwordSchema } from '../auth/auth.schema.js';
import { listMeetingsSchema } from '../meetings/meetings.schema.js';
import { objectIdParam } from '../users/users.schema.js';
import * as controller from './admin.controller.js';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.string().max(60).optional(),
});

const userListSchema = paginationSchema.extend({
  role: z.enum(valuesOf(UserRole)).optional(),
  status: z.enum(valuesOf(UserStatus)).optional(),
});

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(valuesOf(UserRole)).optional(),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(valuesOf(UserRole)).optional(),
  status: z.enum(valuesOf(UserStatus)).optional(),
  emailVerified: z.boolean().optional(),
});

const auditLogSchema = paginationSchema.extend({
  action: z.string().trim().max(60).optional(),
  actorId: z
    .string()
    .regex(/^[a-f0-9]{24}$/i)
    .optional(),
});

const overviewSchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});

export const adminRouter = express.Router();

adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/overview', validate({ query: overviewSchema }), controller.overview);

adminRouter.get('/users', validate({ query: userListSchema }), controller.listUsers);
adminRouter.post('/users', validate({ body: createUserSchema }), controller.createUser);
adminRouter.patch(
  '/users/:id',
  validate({ params: objectIdParam, body: updateUserSchema }),
  controller.updateUser,
);
// Deleting an account is destructive, so it stays with the super admin.
adminRouter.delete(
  '/users/:id',
  requireSuperAdmin,
  validate({ params: objectIdParam }),
  controller.deleteUser,
);

adminRouter.get('/meetings', validate({ query: listMeetingsSchema }), controller.listMeetings);
adminRouter.post(
  '/meetings/:id/end',
  validate({ params: objectIdParam }),
  controller.forceEndMeeting,
);

adminRouter.get('/audit-logs', validate({ query: auditLogSchema }), controller.listAuditLogs);
