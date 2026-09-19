import { logger } from '../../config/logger.js';
import { AuditLog } from '../../models/AuditLog.js';

/**
 * Writing the trail must never break the request that triggered it, so failures
 * are logged and swallowed.
 */
export async function recordAudit(input) {
  try {
    await AuditLog.create(input);
  } catch (error) {
    logger.warn({ err: error, action: input.action }, 'Failed to write audit log');
  }
}
