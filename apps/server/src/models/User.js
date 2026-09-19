import mongoose from 'mongoose';
import {
  DEFAULT_USER_SETTINGS,
  MeetingLayout,
  PresenceStatus,
  UserRole,
  UserStatus,
  valuesOf,
} from '@vcs/shared';

const { Schema, model } = mongoose;

const settingsSchema = new Schema(
  {
    autoJoinAudio: { type: Boolean, default: true },
    autoJoinVideo: { type: Boolean, default: true },
    showMeetingNotifications: { type: Boolean, default: true },
    defaultMeetingLayout: {
      type: String,
      enum: valuesOf(MeetingLayout),
      default: MeetingLayout.Gallery,
    },
    muteOnJoin: { type: Boolean, default: false },
    mirrorSelfView: { type: Boolean, default: true },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, sparse: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String },
    role: { type: String, enum: valuesOf(UserRole), default: UserRole.User, index: true },
    status: { type: String, enum: valuesOf(UserStatus), default: UserStatus.Active, index: true },
    presence: { type: String, enum: valuesOf(PresenceStatus), default: PresenceStatus.Offline },
    emailVerified: { type: Boolean, default: false },
    settings: { type: settingsSchema, default: () => ({ ...DEFAULT_USER_SETTINGS }) },
    /** Live socket count; presence flips to offline at zero. */
    connectionCount: { type: Number, default: 0, min: 0 },
    lastSeenAt: { type: Date },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  { timestamps: true },
);

// Powers the contact search box and the admin user table.
userSchema.index({ name: 'text', email: 'text' });

export const User = model('User', userSchema);
