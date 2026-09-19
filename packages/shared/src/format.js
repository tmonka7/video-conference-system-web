import { MEETING_ID_LENGTH } from './constants.js';

/** Accepts "823 456 789", "823-456-789" or "823456789". */
export function normalizeMeetingId(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** Renders 823456789 as "823 456 789", the way every screen shows it. */
export function formatMeetingId(value) {
  const digits = normalizeMeetingId(value);
  return (digits.match(/.{1,3}/g) ?? []).join(' ');
}

export function isValidMeetingId(value) {
  return normalizeMeetingId(value).length === MEETING_ID_LENGTH;
}

/** "2.4 MB" for the Share Files table. */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/** "09:00" in the viewer's locale, used by the meeting rows. */
export function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatTimeRange(start, end) {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

/** "09:24", "Yesterday" or a date, as the Chat list shows timestamps. */
export function formatChatTimestamp(value) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return formatTime(date);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return formatDate(date);
}

/** "AC" for Alex Chen, used as the avatar fallback. */
export function initialsOf(name) {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

const PRESENCE_LABELS = {
  online: 'Online',
  offline: 'Offline',
  in_meeting: 'In a meeting',
  away: 'Away',
  dnd: 'Do not disturb',
};

export function presenceLabel(presence) {
  return PRESENCE_LABELS[presence] ?? 'Offline';
}

/** Duration since a meeting started, as "01:23:45" for the in-call header. */
export function formatDuration(fromIso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 1000));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}
