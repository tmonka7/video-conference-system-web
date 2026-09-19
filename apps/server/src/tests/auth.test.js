import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { api, auth, createAdmin, createUser, testApp } from './helpers.js';

describe('auth', () => {
  it('registers a new account and returns a session', async () => {
    const response = await request(testApp())
      .post(`${api}/auth/register`)
      .send({ name: 'Alex Chen', email: 'alex@company.com', password: 'Password123' })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe('alex@company.com');
    expect(response.body.data.tokens.accessToken).toBeTruthy();
    // The hash must never leave the server.
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a weak password with field level messages', async () => {
    const response = await request(testApp())
      .post(`${api}/auth/register`)
      .send({ name: 'Alex Chen', email: 'weak@company.com', password: 'short' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.password).toBeDefined();
  });

  it('refuses a duplicate email', async () => {
    const user = await createUser();
    await request(testApp())
      .post(`${api}/auth/register`)
      .send({ name: 'Copy', email: user.email, password: 'Password123' })
      .expect(409);
  });

  it('signs in with an email address', async () => {
    const user = await createUser();
    const response = await request(testApp())
      .post(`${api}/auth/login`)
      .send({ identifier: user.email, password: user.password })
      .expect(200);

    expect(response.body.data.user.id).toBe(user.id);
  });

  it('allows a SuperAdmin to sign in with the seeded credentials', async () => {
    const user = await createAdmin();
    const response = await request(testApp())
      .post(`${api}/auth/login`)
      .send({ identifier: user.email, password: user.password })
      .expect(200);

    expect(response.body.data.user.id).toBe(user.id);
    expect(response.body.data.user.role).toBe('superadmin');
  });

  it('gives the same error for a wrong password and an unknown account', async () => {
    const user = await createUser();

    const wrongPassword = await request(testApp())
      .post(`${api}/auth/login`)
      .send({ identifier: user.email, password: 'Wrong12345' })
      .expect(401);

    const unknownAccount = await request(testApp())
      .post(`${api}/auth/login`)
      .send({ identifier: 'nobody@example.com', password: 'Password123' })
      .expect(401);

    expect(wrongPassword.body.error.message).toBe(unknownAccount.body.error.message);
  });

  it('returns the current user for a valid token', async () => {
    const user = await createUser();
    const response = await request(testApp())
      .get(`${api}/auth/me`)
      .set(...auth(user.accessToken))
      .expect(200);

    expect(response.body.data.email).toBe(user.email);
  });

  it('rejects a missing or malformed token', async () => {
    await request(testApp()).get(`${api}/auth/me`).expect(401);
    await request(testApp())
      .get(`${api}/auth/me`)
      .set('Authorization', 'Bearer not-a-token')
      .expect(401);
  });

  it('rotates the refresh token and refuses the old one', async () => {
    const user = await createUser();

    const rotated = await request(testApp())
      .post(`${api}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(200);

    expect(rotated.body.data.tokens.refreshToken).not.toBe(user.refreshToken);

    // Replaying the consumed token must fail.
    await request(testApp())
      .post(`${api}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it('changes the password and invalidates existing sessions', async () => {
    const user = await createUser();

    await request(testApp())
      .post(`${api}/auth/change-password`)
      .set(...auth(user.accessToken))
      .send({ currentPassword: user.password, newPassword: 'NewPassword123' })
      .expect(200);

    await request(testApp())
      .post(`${api}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(401);

    await request(testApp())
      .post(`${api}/auth/login`)
      .send({ identifier: user.email, password: 'NewPassword123' })
      .expect(200);
  });
});
