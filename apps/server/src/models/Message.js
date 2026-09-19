import mongoose from 'mongoose';
import { MessageType, valuesOf } from '@vcs/shared';

const { Schema, model } = mongoose;

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    /** Absent for system lines such as "Sarah joined the meeting". */
    sender: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    type: { type: String, enum: valuesOf(MessageType), default: MessageType.Text },
    body: { type: String, default: '', maxlength: 8000 },
    attachments: [{ type: Schema.Types.ObjectId, ref: 'FileAsset' }],
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    editedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

// History is paged backwards from the newest message.
messageSchema.index({ conversation: 1, createdAt: -1 });

export const Message = model('Message', messageSchema);
