import { z } from 'zod';
import { MeetingLayout, valuesOf } from '@vcs/shared';
import { phoneSchema } from '../auth/auth.schema.js';

export const objectIdParam = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid identifier'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phoneSchema.nullish(),
  avatarUrl: z.string().max(500).nullish(),
});

export const updateSettingsSchema = z
  .object({
    autoJoinAudio: z.boolean(),
    autoJoinVideo: z.boolean(),
    showMeetingNotifications: z.boolean(),
    defaultMeetingLayout: z.enum(valuesOf(MeetingLayout)),
    muteOnJoin: z.boolean(),
    mirrorSelfView: z.boolean(),
    theme: z.enum(['light', 'dark', 'system']),
    language: z.string().min(2).max(10),
    timezone: z.string().min(1).max(64),
  })
  .partial();

export const searchUsersSchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
