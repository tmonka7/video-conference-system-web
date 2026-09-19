import http from 'node:http';
import request from 'supertest';
import { io as connectClient } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SocketEvent } from '@vcs/shared';
import { createSocketServer } from '../realtime/index.js';
import { api, auth, createUser, testApp } from './helpers.js';

let server;
let ioServer;
let url;
const clients = [];

beforeAll(async () => {
  server = http.createServer(testApp());
  ioServer = createSocketServer(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => {
  while (clients.length) clients.pop()?.disconnect();
});

afterAll(async () => {
  ioServer.close();
  await new Promise((resolve) => server.close(resolve));
});

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = connectClient(url, {
      transports: ['websocket'],
      auth: token ? { token } : undefined,
      forceNew: true,
    });
    clients.push(socket);

    socket.once(SocketEvent.Connected, () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

/** Resolves with the first payload for `event`, or rejects after `ms`. */
function waitFor(socket, event, ms = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), ms);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function startMeeting() {
  const host = await createUser();
  const created = await request(testApp())
    .post(`${api}/meetings/instant`)
    .set(...auth(host.accessToken))
    .send({ title: 'Signaling test' })
    .expect(201);

  return { host, meeting: created.body.data };
}

async function joinRest(meetingId, token, guestName) {
  const pending = request(testApp()).post(`${api}/meetings/join`);
  if (token) pending.set(...auth(token));
  const response = await pending.send({ meetingId, guestName }).expect(200);
  return response.body.data;
}

/** REST join + socket join, returning the connected socket. */
async function joinFully(meeting, token, guestName) {
  const join = await joinRest(meeting.meetingId, token, guestName);
  const socket = await connect(token);
  socket.emit(SocketEvent.MeetingJoin, { joinToken: join.joinToken });
  await waitFor(socket, SocketEvent.MeetingJoined);
  return socket;
}

describe('realtime signaling', () => {
  it('rejects a join without a valid join token', async () => {
    const socket = await connect();
    socket.emit(SocketEvent.MeetingJoin, { joinToken: 'nonsense' });

    const error = await waitFor(socket, SocketEvent.Error);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('puts the host in the room and reports no peers yet', async () => {
    const { host, meeting } = await startMeeting();
    const join = await joinRest(meeting.meetingId, host.accessToken);

    const socket = await connect(host.accessToken);
    socket.emit(SocketEvent.MeetingJoin, { joinToken: join.joinToken });

    const joined = await waitFor(socket, SocketEvent.MeetingJoined);
    expect(joined.peers).toHaveLength(0);
    expect(joined.self.role).toBe('host');
  });

  it('announces a second participant to the people already in the room', async () => {
    const { host, meeting } = await startMeeting();
    const hostSocket = await joinFully(meeting, host.accessToken);

    const guestJoin = await joinRest(meeting.meetingId, undefined, 'Sarah Wilson');
    const guestSocket = await connect();

    const announced = waitFor(hostSocket, SocketEvent.ParticipantJoined);
    guestSocket.emit(SocketEvent.MeetingJoin, { joinToken: guestJoin.joinToken });

    const guestJoined = await waitFor(guestSocket, SocketEvent.MeetingJoined);
    const event = await announced;

    expect(event.participant.displayName).toBe('Sarah Wilson');
    // The joiner is told exactly who to send offers to.
    expect(guestJoined.peers).toHaveLength(1);
    expect(guestJoined.peers[0].socketId).toBe(hostSocket.id);
  });

  it('relays an offer to the addressed peer with the sender stamped', async () => {
    const { host, meeting } = await startMeeting();
    const hostSocket = await joinFully(meeting, host.accessToken);
    const guestSocket = await joinFully(meeting, undefined, 'Guest');

    const delivered = waitFor(hostSocket, SocketEvent.RtcOffer);
    guestSocket.emit(SocketEvent.RtcOffer, {
      targetSocketId: hostSocket.id,
      description: { type: 'offer', sdp: 'v=0 fake-offer' },
    });

    const offer = await delivered;
    expect(offer.description.sdp).toBe('v=0 fake-offer');
    // The server decides who the sender is, not the client.
    expect(offer.fromSocketId).toBe(guestSocket.id);
  });

  it('refuses to relay to a socket in another meeting', async () => {
    const first = await startMeeting();
    const second = await startMeeting();

    const socketA = await joinFully(first.meeting, first.host.accessToken);
    const socketB = await joinFully(second.meeting, second.host.accessToken);

    socketA.emit(SocketEvent.RtcOffer, {
      targetSocketId: socketB.id,
      description: { type: 'offer', sdp: 'v=0 cross-meeting' },
    });

    const error = await waitFor(socketA, SocketEvent.Error);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('broadcasts a media state change to the room', async () => {
    const { host, meeting } = await startMeeting();
    const hostSocket = await joinFully(meeting, host.accessToken);
    const guestSocket = await joinFully(meeting, undefined, 'Guest');

    const updated = waitFor(guestSocket, SocketEvent.ParticipantUpdated);
    hostSocket.emit(SocketEvent.MediaUpdate, { media: { audioEnabled: false } });

    const event = await updated;
    expect(event.participant.media.audioEnabled).toBe(false);
  });

  it('tells the room when someone disconnects', async () => {
    const { host, meeting } = await startMeeting();
    const hostSocket = await joinFully(meeting, host.accessToken);
    const guestSocket = await joinFully(meeting, undefined, 'Guest');

    const left = waitFor(hostSocket, SocketEvent.ParticipantLeft);
    guestSocket.disconnect();

    const event = await left;
    expect(event.participant.displayName).toBe('Guest');
    expect(event.participant.isOnline).toBe(false);
  });

  it('ends the meeting for everyone when the host ends it', async () => {
    const { host, meeting } = await startMeeting();
    const hostSocket = await joinFully(meeting, host.accessToken);
    const guestSocket = await joinFully(meeting, undefined, 'Guest');

    const ended = waitFor(guestSocket, SocketEvent.MeetingEnded);
    hostSocket.emit(SocketEvent.HostEndMeeting, { meetingId: meeting.id });

    const event = await ended;
    expect(event.reason).toBe('host_ended');
  });

  it('does not let a participant end the meeting', async () => {
    const { host, meeting } = await startMeeting();
    await joinFully(meeting, host.accessToken);
    const guestSocket = await joinFully(meeting, undefined, 'Guest');

    guestSocket.emit(SocketEvent.HostEndMeeting, { meetingId: meeting.id });

    const error = await waitFor(guestSocket, SocketEvent.Error);
    expect(error.code).toBe('FORBIDDEN');
  });
});
