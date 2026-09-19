import crypto from 'node:crypto';
import { MEETING_ID_LENGTH } from '@vcs/shared';

/** Nine digits, never starting with 0, matching the "823 456 789" ids in the UI. */
export function generateMeetingId() {
  let id = String(crypto.randomInt(1, 10));
  for (let i = 1; i < MEETING_ID_LENGTH; i += 1) {
    id += String(crypto.randomInt(0, 10));
  }
  return id;
}

export { formatMeetingId, isValidMeetingId, normalizeMeetingId } from '@vcs/shared';
