import request from 'supertest';
import { UserRole } from '@vcs/shared';
import { API_PREFIX, createApp } from '../app.js';
import { User } from '../models/User.js';

export const api = API_PREFIX;

let app = null;

export function testApp() {
  app ??= createApp();
  return app;
}

let counter = 0;

/** Registers a user through the real endpoint, so tokens are produced normally. */
export async function createUser(overrides = {}) {
  counter += 1;
  const email = overrides.email ?? `user${counter}@example.com`;
  const password = overrides.password ?? 'Password123';
  const name = overrides.name ?? `Test User ${counter}`;

  const response = await request(testApp())
    .post(`${api}/auth/register`)
    .send({ name, email, password })
    .expect(201);

  return {
    id: response.body.data.user.id,
    name,
    email,
    password,
    accessToken: response.body.data.tokens.accessToken,
    refreshToken: response.body.data.tokens.refreshToken,
  };
}

export async function createAdmin() {
  const user = await createUser();
  await User.findByIdAndUpdate(user.id, { role: UserRole.SuperAdmin });

  // The role lives in the access token, so sign in again to pick it up.
  const response = await request(testApp())
    .post(`${api}/auth/login`)
    .send({ identifier: user.email, password: user.password })
    .expect(200);

  return { ...user, accessToken: response.body.data.tokens.accessToken };
}

export function auth(token) {
  return ['Authorization', `Bearer ${token}`];
}

/** Tomorrow at 10:00, as the API expects ISO strings. */
export function meetingWindow(offsetDays = 1) {
  const start = new Date();
  start.setDate(start.getDate() + offsetDays);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}
