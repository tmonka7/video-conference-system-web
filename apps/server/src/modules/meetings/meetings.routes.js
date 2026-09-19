import express from 'express';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { joinLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './meetings.controller.js';
import {
  createMeetingSchema,
  inviteSchema,
  joinMeetingSchema,
  listMeetingsSchema,
  lookupParam,
  meetingIdParam,
  participantParam,
  promoteSchema,
  startInstantSchema,
  updateMeetingSchema,
} from './meetings.schema.js';

export const meetingsRouter = express.Router();

// --- open routes (guests joining by meeting id) ---
meetingsRouter.get('/config/ice', controller.ice);
meetingsRouter.get('/lookup/:code', validate({ params: lookupParam }), controller.lookup);
meetingsRouter.post(
  '/join',
  joinLimiter,
  optionalAuth,
  validate({ body: joinMeetingSchema }),
  controller.join,
);

// --- authenticated routes ---
meetingsRouter.use(authenticate);

meetingsRouter.post('/', validate({ body: createMeetingSchema }), controller.create);
meetingsRouter.post('/instant', validate({ body: startInstantSchema }), controller.startInstant);
meetingsRouter.get('/', validate({ query: listMeetingsSchema }), controller.list);

meetingsRouter.get('/:id', validate({ params: meetingIdParam }), controller.getOne);
meetingsRouter.patch(
  '/:id',
  validate({ params: meetingIdParam, body: updateMeetingSchema }),
  controller.update,
);
meetingsRouter.delete('/:id', validate({ params: meetingIdParam }), controller.remove);

meetingsRouter.post('/:id/start', validate({ params: meetingIdParam }), controller.start);
meetingsRouter.post('/:id/end', validate({ params: meetingIdParam }), controller.end);
meetingsRouter.post('/:id/cancel', validate({ params: meetingIdParam }), controller.cancel);
meetingsRouter.post(
  '/:id/invite',
  validate({ params: meetingIdParam, body: inviteSchema }),
  controller.invite,
);

meetingsRouter.get(
  '/:id/participants',
  validate({ params: meetingIdParam }),
  controller.participants,
);
meetingsRouter.delete(
  '/:id/participants/:participantId',
  validate({ params: participantParam }),
  controller.removeParticipant,
);
meetingsRouter.patch(
  '/:id/participants/:participantId/role',
  validate({ params: participantParam, body: promoteSchema }),
  controller.setParticipantRole,
);
