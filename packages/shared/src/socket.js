/**
 * Socket.IO contract.
 *
 * The server never forwards media. It carries the SDP offer/answer exchange and
 * ICE candidates between peers in the same meeting, plus the meeting state every
 * client mirrors in its UI.
 */

export const SocketEvent = Object.freeze({
  // connection lifecycle
  Connected: 'connection:ready',
  Error: 'error:raised',

  // meeting room
  MeetingJoin: 'meeting:join',
  MeetingJoined: 'meeting:joined',
  MeetingLeave: 'meeting:leave',
  MeetingEnded: 'meeting:ended',
  MeetingUpdated: 'meeting:updated',

  ParticipantJoined: 'participant:joined',
  ParticipantLeft: 'participant:left',
  ParticipantUpdated: 'participant:updated',

  // WebRTC signaling
  RtcOffer: 'rtc:offer',
  RtcAnswer: 'rtc:answer',
  RtcCandidate: 'rtc:candidate',

  // media + hand raise
  MediaUpdate: 'media:update',
  ScreenShareStarted: 'screen:started',
  ScreenShareStopped: 'screen:stopped',

  // chat, in meeting and direct
  ChatSend: 'chat:send',
  ChatMessage: 'chat:message',
  ChatTyping: 'chat:typing',
  ChatTypingUpdate: 'chat:typing:update',
  ChatRead: 'chat:read',

  // host controls
  HostMuteParticipant: 'host:mute',
  HostRemoveParticipant: 'host:remove',
  HostEndMeeting: 'host:end',
  HostPromote: 'host:promote',

  // presence
  PresenceUpdate: 'presence:update',
});

export const socketRooms = {
  meeting: (meetingId) => `meeting:${meetingId}`,
  user: (userId) => `user:${userId}`,
  conversation: (conversationId) => `conversation:${conversationId}`,
};

/**
 * Payload shapes, for reference while writing clients.
 *
 * client -> server
 *   meeting:join     { joinToken, media? }
 *   meeting:leave    { meetingId }
 *   rtc:offer        { targetSocketId, description: { type: 'offer', sdp } }
 *   rtc:answer       { targetSocketId, description: { type: 'answer', sdp } }
 *   rtc:candidate    { targetSocketId, candidate }
 *   media:update     { media: { audioEnabled?, videoEnabled?, screenSharing?, handRaised? } }
 *   chat:send        { conversationId?, meetingId?, body, attachmentIds? }
 *   chat:typing      { conversationId, typing }
 *   chat:read        { conversationId, messageId }
 *   host:mute        { participantId }
 *   host:remove      { participantId }
 *   host:promote     { participantId, role }
 *   host:end         { meetingId }
 *
 * server -> client
 *   connection:ready      { socketId, userId }
 *   meeting:joined        { meeting, self, peers }   peers = who to send an offer to
 *   meeting:updated       { meeting }
 *   meeting:ended         { meetingId, reason }
 *   participant:joined    { meetingId, participant }
 *   participant:left      { meetingId, participant }
 *   participant:updated   { meetingId, participant }
 *   rtc:offer             { targetSocketId, fromSocketId, description }
 *   rtc:answer            { targetSocketId, fromSocketId, description }
 *   rtc:candidate         { targetSocketId, fromSocketId, candidate }
 *   screen:started        { meetingId, participant }
 *   screen:stopped        { meetingId, participant }
 *   chat:message          { message }
 *   chat:typing:update    { conversationId, typing, userId, name }
 *   presence:update       { userId, presence }
 *   error:raised          { code, message, event? }
 */
