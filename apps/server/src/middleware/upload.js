import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

fs.mkdirSync(env.uploadDir, { recursive: true });

/**
 * Files land on local disk under UPLOAD_DIR with a random name; the original
 * name is kept in Mongo. Swap this engine for multer-s3 to move uploads off the
 * app server.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.scr',
  '.ps1',
  '.sh',
  '.jar',
]);

export const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes, files: 5 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      cb(ApiError.badRequest(`Files of type ${ext} cannot be uploaded`));
      return;
    }
    cb(null, true);
  },
});

/** Resolves a stored key to a real path, refusing anything that escapes the directory. */
export function absoluteUploadPath(storageKey) {
  const root = path.resolve(env.uploadDir);
  const resolved = path.resolve(root, storageKey);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw ApiError.badRequest('Invalid file path');
  }
  return resolved;
}
