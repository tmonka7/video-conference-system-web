import mongoose from 'mongoose';
import { ConversationType, valuesOf } from '@vcs/shared';

const { Schema, model } = mongoose;

const conversationSchema = new Schema(
  {
    type: { type: String, enum: valuesOf(ConversationType), required: true },
    /** Empty for direct threads, where the UI shows the other person. */
    title: { type: String, trim: true, maxlength: 160 },
    avatarUrl: { type: String },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }],
    /** Set for the chat panel that lives inside a meeting. */
    meeting: { type: Schema.Types.ObjectId, ref: 'Meeting', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
    lastMessageAt: { type: Date, index: true },
    /** Per-user read cursor, keyed by user id. */
    lastReadAt: { type: Map, of: Date, default: () => new Map() },
  },
  { timestamps: true },
);

// The Chat screen lists a user's conversations by most recent activity.
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export const Conversation = model('Conversation', conversationSchema);
