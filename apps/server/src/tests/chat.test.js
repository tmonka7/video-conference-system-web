import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ConversationType } from '@vcs/shared';
import { api, auth, createUser, testApp } from './helpers.js';

async function directConversation(token, otherId) {
  const response = await request(testApp())
    .post(`${api}/chat/conversations`)
    .set(...auth(token))
    .send({ type: ConversationType.Direct, participantIds: [otherId] })
    .expect(201);
  return response.body.data;
}

describe('chat', () => {
  it('reuses the existing thread between the same two people', async () => {
    const alex = await createUser();
    const sarah = await createUser();

    const first = await directConversation(alex.accessToken, sarah.id);
    const second = await directConversation(alex.accessToken, sarah.id);

    expect(second.id).toBe(first.id);
  });

  it('names a direct conversation after the other person', async () => {
    const alex = await createUser({ name: 'Alex Chen' });
    const sarah = await createUser({ name: 'Sarah Wilson' });

    const forAlex = await directConversation(alex.accessToken, sarah.id);
    expect(forAlex.title).toBe('Sarah Wilson');

    const list = await request(testApp())
      .get(`${api}/chat/conversations`)
      .set(...auth(sarah.accessToken))
      .expect(200);

    expect(list.body.data.items[0].title).toBe('Alex Chen');
  });

  it('sends messages and returns them oldest first', async () => {
    const alex = await createUser();
    const sarah = await createUser();
    const conversation = await directConversation(alex.accessToken, sarah.id);

    await request(testApp())
      .post(`${api}/chat/conversations/${conversation.id}/messages`)
      .set(...auth(sarah.accessToken))
      .send({ body: 'Hi Alex, are you available for the meeting at 10 AM?' })
      .expect(201);

    await request(testApp())
      .post(`${api}/chat/conversations/${conversation.id}/messages`)
      .set(...auth(alex.accessToken))
      .send({ body: "Yes, I'll be there!" })
      .expect(201);

    const messages = await request(testApp())
      .get(`${api}/chat/conversations/${conversation.id}/messages`)
      .set(...auth(alex.accessToken))
      .expect(200);

    expect(messages.body.data.items).toHaveLength(2);
    expect(messages.body.data.items[0].body).toContain('are you available');
  });

  it('rejects an empty message with no attachment', async () => {
    const alex = await createUser();
    const sarah = await createUser();
    const conversation = await directConversation(alex.accessToken, sarah.id);

    await request(testApp())
      .post(`${api}/chat/conversations/${conversation.id}/messages`)
      .set(...auth(alex.accessToken))
      .send({ body: '   ' })
      .expect(400);
  });

  it('keeps outsiders out of a conversation', async () => {
    const alex = await createUser();
    const sarah = await createUser();
    const stranger = await createUser();
    const conversation = await directConversation(alex.accessToken, sarah.id);

    await request(testApp())
      .get(`${api}/chat/conversations/${conversation.id}/messages`)
      .set(...auth(stranger.accessToken))
      .expect(403);
  });

  it('counts unread messages until the thread is read', async () => {
    const alex = await createUser();
    const sarah = await createUser();
    const conversation = await directConversation(alex.accessToken, sarah.id);

    await request(testApp())
      .post(`${api}/chat/conversations/${conversation.id}/messages`)
      .set(...auth(sarah.accessToken))
      .send({ body: 'Sounds good! See you then.' })
      .expect(201);

    const before = await request(testApp())
      .get(`${api}/chat/conversations/${conversation.id}`)
      .set(...auth(alex.accessToken))
      .expect(200);
    expect(before.body.data.unreadCount).toBe(1);

    await request(testApp())
      .post(`${api}/chat/conversations/${conversation.id}/read`)
      .set(...auth(alex.accessToken))
      .send({})
      .expect(204);

    const after = await request(testApp())
      .get(`${api}/chat/conversations/${conversation.id}`)
      .set(...auth(alex.accessToken))
      .expect(200);
    expect(after.body.data.unreadCount).toBe(0);
  });
});

describe('contacts', () => {
  it('adds a contact by email and mirrors it as incoming', async () => {
    const alex = await createUser();
    const sarah = await createUser();

    const added = await request(testApp())
      .post(`${api}/contacts`)
      .set(...auth(alex.accessToken))
      .send({ identifier: sarah.email })
      .expect(201);

    expect(added.body.data.user.id).toBe(sarah.id);
    expect(added.body.data.status).toBe('pending');

    const sarahView = await request(testApp())
      .get(`${api}/contacts`)
      .set(...auth(sarah.accessToken))
      .expect(200);

    expect(sarahView.body.data.items[0].incoming).toBe(true);
  });

  it('accepting updates both sides', async () => {
    const alex = await createUser();
    const sarah = await createUser();

    await request(testApp())
      .post(`${api}/contacts`)
      .set(...auth(alex.accessToken))
      .send({ identifier: sarah.email })
      .expect(201);

    const sarahContacts = await request(testApp())
      .get(`${api}/contacts`)
      .set(...auth(sarah.accessToken))
      .expect(200);

    await request(testApp())
      .post(`${api}/contacts/${sarahContacts.body.data.items[0].id}/accept`)
      .set(...auth(sarah.accessToken))
      .expect(200);

    const alexContacts = await request(testApp())
      .get(`${api}/contacts`)
      .set(...auth(alex.accessToken))
      .expect(200);

    expect(alexContacts.body.data.items[0].status).toBe('accepted');
  });

  it('refuses a duplicate and refuses adding yourself', async () => {
    const alex = await createUser();
    const sarah = await createUser();

    await request(testApp())
      .post(`${api}/contacts`)
      .set(...auth(alex.accessToken))
      .send({ identifier: sarah.email })
      .expect(201);

    await request(testApp())
      .post(`${api}/contacts`)
      .set(...auth(alex.accessToken))
      .send({ identifier: sarah.email })
      .expect(409);

    await request(testApp())
      .post(`${api}/contacts`)
      .set(...auth(alex.accessToken))
      .send({ identifier: alex.email })
      .expect(400);
  });
});
