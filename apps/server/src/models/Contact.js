import mongoose from 'mongoose';
import { ContactStatus, valuesOf } from '@vcs/shared';

const { Schema, model } = mongoose;

/**
 * One row per direction: adding someone creates the mirrored row too, so both
 * people can favourite and remove independently.
 */
const contactSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contact: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: valuesOf(ContactStatus),
      default: ContactStatus.Pending,
      index: true,
    },
    favorite: { type: Boolean, default: false },
    /** True on the row belonging to the person who received the invitation. */
    incoming: { type: Boolean, default: false },
  },
  { timestamps: true },
);

contactSchema.index({ owner: 1, contact: 1 }, { unique: true });

export const Contact = model('Contact', contactSchema);
