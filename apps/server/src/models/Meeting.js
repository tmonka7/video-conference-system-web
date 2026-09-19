import mongoose from 'mongoose';
import {
  DEFAULT_MEETING_SETTINGS,
  MeetingLayout,
  MeetingRole,
  MeetingStatus,
  MESH_PARTICIPANT_LIMIT,
  RecurrenceFrequency,
  valuesOf,
} from '@vcs/shared';

const { Schema, model } = mongoose;

const mediaSchema = new Schema(
  {
    audioEnabled: { type: Boolean, default: true },
    videoEnabled: { type: Boolean, default: true },
    screenSharing: { type: Boolean, default: false },
    handRaised: { type: Boolean, default: false },
  },
  { _id: false },
);

const participantSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  /** Set when someone joins by meeting id without signing in. */
  guestName: { type: String, trim: true, maxlength: 80 },
  displayName: { type: String, required: true, trim: true, maxlength: 80 },
  role: { type: String, enum: valuesOf(MeetingRole), default: MeetingRole.Participant },
  media: {
    type: mediaSchema,
    default: () => ({
      audioEnabled: true,
      videoEnabled: true,
      screenSharing: false,
      handRaised: false,
    }),
  },
  /** Socket id while connected, cleared on disconnect. */
  socketId: { type: String, index: true },
  isOnline: { type: Boolean, default: false },
  joinedAt: { type: Date },
  leftAt: { type: Date },
});

const settingsSchema = new Schema(
  {
    waitingRoom: { type: Boolean, default: false },
    muteParticipantsOnEntry: { type: Boolean, default: false },
    allowParticipantScreenShare: { type: Boolean, default: true },
    allowChat: { type: Boolean, default: true },
    allowRecording: { type: Boolean, default: false },
    joinBeforeHost: { type: Boolean, default: true },
    maxParticipants: {
      type: Number,
      default: MESH_PARTICIPANT_LIMIT,
      min: 2,
      max: MESH_PARTICIPANT_LIMIT,
    },
    defaultLayout: {
      type: String,
      enum: valuesOf(MeetingLayout),
      default: MeetingLayout.Gallery,
    },
  },
  { _id: false },
);

const recurrenceSchema = new Schema(
  {
    frequency: {
      type: String,
      enum: valuesOf(RecurrenceFrequency),
      default: RecurrenceFrequency.None,
    },
    interval: { type: Number, default: 1, min: 1, max: 52 },
    /** 0 = Sunday .. 6 = Saturday, used when frequency is weekly. */
    daysOfWeek: { type: [Number], default: undefined },
    until: { type: String },
  },
  { _id: false },
);

const meetingSchema = new Schema(
  {
    meetingId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000 },
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: valuesOf(MeetingStatus),
      default: MeetingStatus.Scheduled,
      index: true,
    },
    passcodeHash: { type: String, select: false },
    scheduledStart: { type: Date, required: true, index: true },
    scheduledEnd: { type: Date, required: true },
    startedAt: { type: Date },
    endedAt: { type: Date },
    settings: { type: settingsSchema, default: () => ({ ...DEFAULT_MEETING_SETTINGS }) },
    recurrence: { type: recurrenceSchema, default: undefined },
    invitees: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    participants: { type: [participantSchema], default: [] },
  },
  { timestamps: true },
);

// The Meetings screen lists a user's meetings by time within each tab.
meetingSchema.index({ host: 1, scheduledStart: -1 });
meetingSchema.index({ invitees: 1, scheduledStart: -1 });
meetingSchema.index({ status: 1, scheduledStart: 1 });

export const Meeting = model('Meeting', meetingSchema);
