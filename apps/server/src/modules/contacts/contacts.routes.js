import express from 'express';
import { z } from 'zod';
import { ContactStatus, valuesOf } from '@vcs/shared';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { objectIdParam } from '../users/users.schema.js';
import * as controller from './contacts.controller.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(120).optional(),
  status: z.enum(valuesOf(ContactStatus)).optional(),
  favoritesOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
});

const addSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter an email address or phone number').max(160),
});

const favoriteSchema = z.object({ favorite: z.boolean() });

export const contactsRouter = express.Router();

contactsRouter.use(authenticate);

contactsRouter.get('/', validate({ query: listQuerySchema }), controller.list);
contactsRouter.post('/', validate({ body: addSchema }), controller.add);
contactsRouter.post('/:id/accept', validate({ params: objectIdParam }), controller.accept);
contactsRouter.post('/:id/block', validate({ params: objectIdParam }), controller.block);
contactsRouter.patch(
  '/:id/favorite',
  validate({ params: objectIdParam, body: favoriteSchema }),
  controller.favorite,
);
contactsRouter.delete('/:id', validate({ params: objectIdParam }), controller.remove);
