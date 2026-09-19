import { z } from 'zod';
import {
  MeetingLayout,
  MeetingListFilter,
  MeetingRole,
  MESH_PARTICIPANT_LIMIT,
  RecurrenceFrequency,
  valuesOf,
} from '@vcs/shared';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid identifier');

export const meetingSettingsSchema = z
  .object({
    waitingRoom: z.boolean(),
    muteParticipantsOnEntry: z.boolean(),
    allowParticipantScreenShare: z.boolean(),
    allowChat: z.boolean(),
    allowRecording: z.boolean(),
    joinBeforeHost: z.boolean(),
    maxParticipants: z.coerce.number().int().min(2).max(MESH_PARTICIPANT_LIMIT),
    defaultLayout: z.enum(valuesOf(MeetingLayout)),
  })
  .partial();

export const recurrenceSchema = z.object({
  frequency: z.enum(valuesOf(RecurrenceFrequency)),
  interval: z.coerce.number().int().min(1).max(52).default(1),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional(),
  until: z.string().datetime().optional(),
});

export const createMeetingSchema = z
  .object({
    title: z.string().trim().min(2, 'Give the meeting a title').max(160),
    description: z.string().trim().max(2000).optional(),
    scheduledStart: z.string().datetime({ message: 'Invalid start time' }),
    scheduledEnd: z.string().datetime({ message: 'Invalid end time' }),
    passcode: z.string().trim().min(4).max(20).optional(),
    inviteeIds: z.array(objectId).max(100).optional(),
    settings: meetingSettingsSchema.optional(),
    recurrence: recurrenceSchema.optional(),
  })
  .refine((value) => new Date(value.scheduledEnd) > new Date(value.scheduledStart), {
    message: 'The end time must be after the start time',
    path: ['scheduledEnd'],
  });

export const updateMeetingSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(2000).nullish(),
    scheduledStart: z.string().datetime().optional(),
    scheduledEnd: z.string().datetime().optional(),
    // An empty string clears the passcode.
    passcode: z.string().trim().max(20).nullish(),
    inviteeIds: z.array(objectId).max(100).optional(),
    settings: meetingSettingsSchema.optional(),
    recurrence: recurrenceSchema.nullish(),
  })
  .refine(
    (value) =>
      !value.scheduledStart ||
      !value.scheduledEnd ||
      new Date(value.scheduledEnd) > new Date(value.scheduledStart),
    { message: 'The end time must be after the start time', path: ['scheduledEnd'] },
  );

export const startInstantSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  settings: meetingSettingsSchema.optional(),
});

export const listMeetingsSchema = z.object({
  filter: z.enum(valuesOf(MeetingListFilter)).optional().default(MeetingListFilter.Upcoming),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(160).optional(),
  sort: z.string().max(60).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const mediaStateSchema = z
  .object({
    audioEnabled: z.boolean(),
    videoEnabled: z.boolean(),
    screenSharing: z.boolean(),
    handRaised: z.boolean(),
  })
  .partial();

export const joinMeetingSchema = z.object({
  // Accepts "823 456 789" as typed on the Join screen.
  meetingId: z.string().trim().min(9).max(20),
  passcode: z.string().trim().max(20).optional(),
  guestName: z.string().trim().min(2).max(80).optional(),
  media: mediaStateSchema.optional(),
});

export const meetingIdParam = z.object({
  id: z.string().trim().min(1),
});

export const participantParam = z.object({
  id: z.string().trim().min(1),
  participantId: objectId,
});

export const promoteSchema = z.object({
  role: z.enum(valuesOf(MeetingRole)),
});

export const inviteSchema = z.object({
  inviteeIds: z.array(objectId).min(1).max(100),
});

export const lookupParam = z.object({
  code: z.string().trim().min(9).max(20),
});
