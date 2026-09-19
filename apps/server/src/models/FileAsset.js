import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const fileAssetSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 255 },
    size: { type: Number, required: true, min: 0 },
    mimeType: { type: String, required: true },
    /** Path on disk relative to UPLOAD_DIR. Swap for an S3 key to move storage. */
    storageKey: { type: String, required: true, unique: true },
    meeting: { type: Schema.Types.ObjectId, ref: 'Meeting', index: true },
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },
  },
  { timestamps: true },
);

fileAssetSchema.index({ owner: 1, createdAt: -1 });

export const FileAsset = model('FileAsset', fileAssetSchema);
