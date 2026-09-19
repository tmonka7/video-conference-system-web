import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { MeetingStatus } from '@vcs/shared';
import { Meeting } from '../models/Meeting.js';
import { api, auth, createUser, meetingWindow, testApp } from './helpers.js';

async function createMeeting(token, overrides = {}) {
  const { start, end } = meetingWindow();
  const response = await request(testApp())
    .post(`${api}/meetings`)
    .set(...auth(token))
    .send({
      title: 'Project Kickoff Meeting',
      scheduledStart: start,
      scheduledEnd: end,
      ...overrides,
    })
    .expect(201);

  return response.body.data;
}

describe('meetings', () => {
  it('schedules a meeting with a nine digit id', async () => {
    const host = await createUser();
    const meeting = await createMeeting(host.accessToken);

    expect(meeting.meetingId).toMatch(/^[1-9][0-9]{8}$/);
    expect(meeting.status).toBe(MeetingStatus.Scheduled);
    expect(meeting.host.id).toBe(host.id);
    expect(meeting.joinUrl).toContain(meeting.meetingId);
  });

  it('refuses an end time before the start time', async () => {
    const host = await createUser();
    const { start, end } = meetingWindow();

    const response = await request(testApp())
      .post(`${api}/meetings`)
      .set(...auth(host.accessToken))
      .send({ title: 'Backwards', scheduledStart: end, scheduledEnd: start })
      .expect(422);

    expect(response.body.error.details.scheduledEnd).toBeDefined();
  });

  it('starts an instant meeting that is immediately live', async () => {
    const host = await createUser();
    const response = await request(testApp())
      .post(`${api}/meetings/instant`)
      .set(...auth(host.accessToken))
      .send({})
      .expect(201);

    expect(response.body.data.status).toBe(MeetingStatus.Live);
    expect(response.body.data.startedAt).toBeTruthy();
  });

  it('splits the list into upcoming and past', async () => {
    const host = await createUser();
    await createMeeting(host.accessToken);

    const upcoming = await request(testApp())
      .get(`${api}/meetings?filter=upcoming`)
      .set(...auth(host.accessToken))
      .expect(200);

    const past = await request(testApp())
      .get(`${api}/meetings?filter=past`)
      .set(...auth(host.accessToken))
      .expect(200);

    expect(upcoming.body.data.items).toHaveLength(1);
    expect(past.body.data.items).toHaveLength(0);
    expect(upcoming.body.data.meta.total).toBe(1);
  });

  it('hides meetings from people who are not involved', async () => {
    const host = await createUser();
    const stranger = await createUser();
    const meeting = await createMeeting(host.accessToken);

    await request(testApp())
      .get(`${api}/meetings/${meeting.id}`)
      .set(...auth(stranger.accessToken))
      .expect(403);
  });

  it('lets an invited user join by meeting id and issues a join token', async () => {
    const host = await createUser();
    const guest = await createUser();
    const meeting = await createMeeting(host.accessToken, { inviteeIds: [guest.id] });

    const response = await request(testApp())
      .post(`${api}/meetings/join`)
      .set(...auth(guest.accessToken))
      .send({ meetingId: meeting.meetingId })
      .expect(200);

    expect(response.body.data.joinToken).toBeTruthy();
    expect(response.body.data.participant.displayName).toBe(guest.name);
    expect(response.body.data.iceServers.length).toBeGreaterThan(0);
  });

  it('accepts a spaced meeting id as typed on the join screen', async () => {
    const host = await createUser();
    const meeting = await createMeeting(host.accessToken);
    const spaced = meeting.meetingId.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');

    await request(testApp())
      .post(`${api}/meetings/join`)
      .set(...auth(host.accessToken))
      .send({ meetingId: spaced })
      .expect(200);
  });

  it('requires the passcode when one is set', async () => {
    const host = await createUser();
    const guest = await createUser();
    const meeting = await createMeeting(host.accessToken, { passcode: 'secret1' });

    const denied = await request(testApp())
      .post(`${api}/meetings/join`)
      .set(...auth(guest.accessToken))
      .send({ meetingId: meeting.meetingId })
      .expect(403);
    expect(denied.body.error.code).toBe('INVALID_PASSCODE');

    await request(testApp())
      .post(`${api}/meetings/join`)
      .set(...auth(guest.accessToken))
      .send({ meetingId: meeting.meetingId, passcode: 'secret1' })
      .expect(200);
  });

  it('lets a guest join with a display name but not anonymously', async () => {
    const host = await createUser();
    const meeting = await createMeeting(host.accessToken);

    await request(testApp())
      .post(`${api}/meetings/join`)
      .send({ meetingId: meeting.meetingId })
      .expect(400);

    const guest = await request(testApp())
      .post(`${api}/meetings/join`)
      .send({ meetingId: meeting.meetingId, guestName: 'Visitor' })
      .expect(200);

    expect(guest.body.data.participant.displayName).toBe('Visitor');
  });

  it('turns the host joining a scheduled meeting into a live meeting', async () => {
    const host = await createUser();
    const meeting = await createMeeting(host.accessToken);

    const response = await request(testApp())
      .post(`${api}/meetings/join`)
      .set(...auth(host.accessToken))
      .send({ meetingId: meeting.meetingId })
      .expect(200);

    expect(response.body.data.meeting.status).toBe(MeetingStatus.Live);
    expect(response.body.data.participant.role).toBe('host');
  });

  it('refuses a new participant once the meeting is full', async () => {
    const host = await createUser();
    const meeting = await createMeeting(host.accessToken, { settings: { maxParticipants: 2 } });

    for (const name of ['One', 'Two']) {
      await request(testApp())
        .post(`${api}/meetings/join`)
        .send({ meetingId: meeting.meetingId, guestName: name })
        .expect(200);
    }

    // Capacity counts connected peers, which the socket gateway sets on join.
    await Meeting.updateOne({ _id: meeting.id }, { $set: { 'participants.$[].isOnline': true } });

    const response = await request(testApp())
      .post(`${api}/meetings/join`)
      .send({ meetingId: meeting.meetingId, guestName: 'Three' })
      .expect(403);

    expect(response.body.error.code).toBe('MEETING_FULL');
  });

  it('rejects joining a meeting that has ended', async () => {
    const host = await createUser();
    const meeting = await createMeeting(host.accessToken);

    await request(testApp())
      .post(`${api}/meetings/${meeting.id}/end`)
      .set(...auth(host.accessToken))
      .expect(200);

    const response = await request(testApp())
      .post(`${api}/meetings/join`)
      .set(...auth(host.accessToken))
      .send({ meetingId: meeting.meetingId })
      .expect(409);

    expect(response.body.error.code).toBe('MEETING_ENDED');
  });

  it('only lets the host edit the meeting', async () => {
    const host = await createUser();
    const other = await createUser();
    const meeting = await createMeeting(host.accessToken, { inviteeIds: [other.id] });

    await request(testApp())
      .patch(`${api}/meetings/${meeting.id}`)
      .set(...auth(other.accessToken))
      .send({ title: 'Hijacked' })
      .expect(403);

    await request(testApp())
      .patch(`${api}/meetings/${meeting.id}`)
      .set(...auth(host.accessToken))
      .send({ title: 'Renamed' })
      .expect(200);
  });

  it('exposes a public lookup for the join screen', async () => {
    const host = await createUser();
    const meeting = await createMeeting(host.accessToken, { passcode: 'secret1' });

    const response = await request(testApp())
      .get(`${api}/meetings/lookup/${meeting.meetingId}`)
      .expect(200);

    expect(response.body.data.title).toBe('Project Kickoff Meeting');
    expect(response.body.data.hasPasscode).toBe(true);
    // The lookup must not leak the passcode itself.
    expect(JSON.stringify(response.body)).not.toContain('secret1');
  });
});
