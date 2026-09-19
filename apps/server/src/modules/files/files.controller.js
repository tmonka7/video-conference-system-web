import { absoluteUploadPath } from '../../middleware/upload.js';
import { toFileDto } from '../../mappers/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, noContent, ok } from '../../utils/response.js';
import * as filesService from './files.service.js';

export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file was uploaded');

  const file = await filesService.createFileFromUpload(req.user._id, req.file, {
    meetingId: req.body?.meetingId,
    conversationId: req.body?.conversationId,
  });
  created(res, file);
});

export const list = asyncHandler(async (req, res) => {
  ok(res, await filesService.listFiles(req.user._id.toString(), req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  ok(res, toFileDto(await filesService.getFileOrThrow(req.params.id)));
});

export const download = asyncHandler(async (req, res) => {
  const file = await filesService.getFileOrThrow(req.params.id);
  res.download(absoluteUploadPath(file.storageKey), file.name);
});

export const remove = asyncHandler(async (req, res) => {
  await filesService.deleteFile(req.params.id, req.user._id.toString());
  noContent(res);
});
