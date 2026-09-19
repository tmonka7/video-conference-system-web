import { socketRooms } from '@vcs/shared';

let io = null;

export function setIo(server) {
  io = server;
}

export function getIo() {
  return io;
}

/**
 * REST handlers broadcast through these helpers. They are no-ops when the socket
 * server has not started, which keeps API-only tests simple.
 */
export function emitToMeeting(meetingId, event, payload) {
  io?.to(socketRooms.meeting(meetingId)).emit(event, payload);
}

export function emitToUser(userId, event, payload) {
  io?.to(socketRooms.user(userId)).emit(event, payload);
}

export function emitToConversation(conversationId, event, payload) {
  io?.to(socketRooms.conversation(conversationId)).emit(event, payload);
}
