import { PresenceStatus, SocketEvent, socketRooms } from '@vcs/shared';
import { User } from '../models/User.js';
import { getIo } from './io.js';

/** Contacts screens subscribe to the user room of everyone they know. */
function broadcastPresence(userId, presence) {
  getIo()?.to(socketRooms.user(userId)).emit(SocketEvent.PresenceUpdate, { userId, presence });
}

/**
 * Presence is derived from how many live sockets a user has, so opening a second
 * tab does not knock them offline when the first one closes.
 */
export async function markConnected(userId) {
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $inc: { connectionCount: 1 },
      $set: { presence: PresenceStatus.Online, lastSeenAt: new Date() },
    },
    { new: true },
  );
  if (user) broadcastPresence(userId, user.presence);
}

export async function markDisconnected(userId) {
  const user = await User.findById(userId);
  if (!user) return;

  user.connectionCount = Math.max(0, user.connectionCount - 1);
  user.lastSeenAt = new Date();
  if (user.connectionCount === 0) user.presence = PresenceStatus.Offline;
  await user.save();

  broadcastPresence(userId, user.presence);
}

export async function setPresence(userId, presence) {
  await User.findByIdAndUpdate(userId, { presence });
  broadcastPresence(userId, presence);
}
