import fs from 'node:fs/promises';
import { logger } from '../../config/logger.js';
import { absoluteUploadPath } from '../../middleware/upload.js';
import { toFileDto } from '../../mappers/index.js';
import { FileAsset } from '../../models/FileAsset.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, resolvePagination, resolveSort } from '../../utils/pagination.js';
import { paginated } from '../../utils/response.js';

export async function createFileFromUpload(ownerId, file, context = {}) {
  const asset = await FileAsset.create({
    owner: ownerId,
    name: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    storageKey: file.filename,
    meeting: context.meetingId || undefined,
    conversation: context.conversationId || undefined,
  });

  await asset.populate('owner');
  return toFileDto(asset);
}

export async function listFiles(viewerId, query) {
  const { page, limit, skip } = resolvePagination(query, 20);

  const filter = {};
  if (query.meetingId) {
    filter.meeting = query.meetingId;
  } else if (query.conversationId) {
    filter.conversation = query.conversationId;
  } else {
    // The Share Files screen defaults to the signed-in user's own uploads.
    filter.owner = viewerId;
  }

  if (query.search) filter.name = new RegExp(escapeRegex(query.search), 'i');

  const [docs, total] = await Promise.all([
    FileAsset.find(filter)
      .sort(resolveSort(query.sort, { createdAt: -1 }))
      .skip(skip)
      .limit(limit)
      .populate('owner'),
    FileAsset.countDocuments(filter),
  ]);

  return paginated(docs.map(toFileDto), total, page, limit);
}

export async function getFileOrThrow(id) {
  const file = await FileAsset.findById(id).populate('owner');
  if (!file) throw ApiError.notFound('File not found');
  return file;
}

/** Attachments must belong to the sender, so a message cannot cite someone else's file. */
export async function resolveAttachments(ownerId, attachmentIds = []) {
  if (attachmentIds.length === 0) return [];

  const files = await FileAsset.find({ _id: { $in: attachmentIds }, owner: ownerId });
  if (files.length !== attachmentIds.length) {
    throw ApiError.badRequest('One or more attachments could not be found');
  }
  return files.map((file) => file._id);
}

export async function deleteFile(id, requesterId) {
  const file = await FileAsset.findById(id);
  if (!file) throw ApiError.notFound('File not found');
  if (file.owner.toString() !== requesterId) {
    throw ApiError.forbidden('Only the uploader can delete this file');
  }

  await file.deleteOne();

  try {
    await fs.unlink(absoluteUploadPath(file.storageKey));
  } catch (error) {
    // A missing file on disk should not fail the request; the record is gone.
    logger.warn({ err: error, storageKey: file.storageKey }, 'Could not remove file from disk');
  }
}
