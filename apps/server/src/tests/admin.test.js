import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { UserStatus } from '@vcs/shared';
import { api, auth, createAdmin, createUser, meetingWindow, testApp } from './helpers.js';

describe('admin panel', () => {
  it('keeps ordinary users out', async () => {
    const user = await createUser();
    await request(testApp())
      .get(`${api}/admin/overview`)
      .set(...auth(user.accessToken))
      .expect(403);
  });

  it('reports overview counters with one trend point per day', async () => {
    const admin = await createAdmin();
    const host = await createUser();
    const { start, end } = meetingWindow(0);

    await request(testApp())
      .post(`${api}/meetings`)
      .set(...auth(host.accessToken))
      .send({ title: 'Team Sync', scheduledStart: start, scheduledEnd: end })
      .expect(201);

    const response = await request(testApp())
      .get(`${api}/admin/overview?days=7`)
      .set(...auth(admin.accessToken))
      .expect(200);

    expect(response.body.data.users.total).toBeGreaterThanOrEqual(2);
    expect(response.body.data.meetings.total).toBe(1);
    expect(response.body.data.trend).toHaveLength(7);
  });

  it('lists and filters users', async () => {
    const admin = await createAdmin();
    await createUser({ name: 'Emily Davis', email: 'emily@company.com' });

    const response = await request(testApp())
      .get(`${api}/admin/users?search=emily`)
      .set(...auth(admin.accessToken))
      .expect(200);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].email).toBe('emily@company.com');
  });

  it('suspends a user and ends their sessions', async () => {
    const admin = await createAdmin();
    const user = await createUser();

    await request(testApp())
      .patch(`${api}/admin/users/${user.id}`)
      .set(...auth(admin.accessToken))
      .send({ status: UserStatus.Suspended })
      .expect(200);

    // The access token is still signed, but the account check rejects it.
    await request(testApp())
      .get(`${api}/auth/me`)
      .set(...auth(user.accessToken))
      .expect(403);

    await request(testApp())
      .post(`${api}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it('refuses to let an admin suspend themselves', async () => {
    const admin = await createAdmin();

    await request(testApp())
      .patch(`${api}/admin/users/${admin.id}`)
      .set(...auth(admin.accessToken))
      .send({ status: UserStatus.Suspended })
      .expect(400);
  });

  it('writes an audit entry for administrative changes', async () => {
    const admin = await createAdmin();
    const user = await createUser();

    await request(testApp())
      .patch(`${api}/admin/users/${user.id}`)
      .set(...auth(admin.accessToken))
      .send({ name: 'Renamed' })
      .expect(200);

    const logs = await request(testApp())
      .get(`${api}/admin/audit-logs?action=admin.user_updated`)
      .set(...auth(admin.accessToken))
      .expect(200);

    expect(logs.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(logs.body.data.items[0].actor.id).toBe(admin.id);
  });

  it('force ends a live meeting', async () => {
    const admin = await createAdmin();
    const host = await createUser();

    const meeting = await request(testApp())
      .post(`${api}/meetings/instant`)
      .set(...auth(host.accessToken))
      .send({})
      .expect(201);

    const ended = await request(testApp())
      .post(`${api}/admin/meetings/${meeting.body.data.id}/end`)
      .set(...auth(admin.accessToken))
      .expect(200);

    expect(ended.body.data.status).toBe('ended');
  });
});
