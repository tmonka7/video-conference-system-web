import { toUserDto } from '../../mappers/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { noContent, ok } from '../../utils/response.js';
import { createFileFromUpload } from '../files/files.service.js';
import * as usersService from './users.service.js';

export const me = asyncHandler(async (req, res) => {
  ok(res, toUserDto(req.user));
});

export const updateProfile = asyncHandler(async (req, res) => {
  ok(res, await usersService.updateProfile(req.user, req.body));
});

export const updateSettings = asyncHandler(async (req, res) => {
  ok(res, await usersService.updateSettings(req.user, req.body));
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image was uploaded');
  if (!req.file.mimetype.startsWith('image/')) {
    throw ApiError.badRequest('Avatar must be an image');
  }

  const file = await createFileFromUpload(req.user._id, req.file);
  ok(res, await usersService.setAvatar(req.user, file.url));
});

export const search = asyncHandler(async (req, res) => {
  ok(res, await usersService.searchUsers(req.user._id.toString(), req.query));
});

export const getById = asyncHandler(async (req, res) => {
  ok(res, await usersService.getUserById(req.params.id));
});

export const deactivate = asyncHandler(async (req, res) => {
  await usersService.deactivateSelf(req.user);
  noContent(res);
});
