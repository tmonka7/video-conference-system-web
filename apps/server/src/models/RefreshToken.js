import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * One row per signed-in device. Tokens are stored hashed and rotated on every
 * refresh, so a stolen token stops working as soon as the real client refreshes.
 */
const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** Also embedded in the access token as `sid`. */
    sessionId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    userAgent: { type: String },
    ip: { type: String },
    revokedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Mongo removes expired sessions on its own.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model('RefreshToken', refreshTokenSchema);
