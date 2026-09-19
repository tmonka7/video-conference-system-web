import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './users.controller.js';
import {
  objectIdParam,
  searchUsersSchema,
  updateProfileSchema,
  updateSettingsSchema,
} from './users.schema.js';

export const usersRouter = express.Router();

usersRouter.use(authenticate);

usersRouter.get('/me', controller.me);
usersRouter.patch('/me', validate({ body: updateProfileSchema }), controller.updateProfile);
usersRouter.patch(
  '/me/settings',
  validate({ body: updateSettingsSchema }),
  controller.updateSettings,
);
usersRouter.post('/me/avatar', uploadLimiter, upload.single('avatar'), controller.uploadAvatar);
usersRouter.delete('/me', controller.deactivate);

usersRouter.get('/', validate({ query: searchUsersSchema }), controller.search);
usersRouter.get('/:id', validate({ params: objectIdParam }), controller.getById);
