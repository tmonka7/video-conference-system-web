import mongoose from 'mongoose';
import { ConversationType, MessageType } from '@vcs/shared';
import { idOf, toConversationDto, toMessageDto } from '../../mappers/index.js';
import { Conversation } from '../../models/Conversation.js';
import { Message } from '../../models/Message.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import { resolvePagination } from '../../utils/pagination.js';
import { paginated } from '../../utils/response.js';
import { resolveAttachments } from '../files/files.service.js';

const { Types } = mongoose;

const CONVERSATION_POPULATE = [
  { path: 'participants' },
  { path: 'lastMessage', populate: [{ path: 'sender' }, { path: 'attachments' }] },
];

const MESSAGE_POPULATE = [{ path: 'sender' }, { path: 'attachments' }];

function isMember(conversation, userId) {
  // Participants may or may not be populated depending on the caller.
  return conversation.participants.some((participant) => idOf(participant) === userId);
}

export async function assertMember(conversationId, userId) {
  const conversation = await Conversation.findById(conversationId).populate(CONVERSATION_POPULATE);
  if (!conversation) throw ApiError.notFound('Conversation not found');
  if (!isMember(conversation, userId)) {
    throw ApiError.forbidden('You are not part of this conversation');
  }
  return conversation;
}

function unreadCountFor(conversation, userId) {
  const lastReadAt = conversation.lastReadAt?.get(userId);
  return Message.countDocuments({
    conversation: conversation._id,
    sender: { $ne: userId },
    ...(lastReadAt ? { createdAt: { $gt: lastReadAt } } : {}),
  });
}

export async function listConversations(userId, query) {
  const { page, limit, skip } = resolvePagination(query, 30);
  const filter = { participants: userId };

  const [docs, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(CONVERSATION_POPULATE),
    Conversation.countDocuments(filter),
  ]);

  const items = await Promise.all(
    docs.map(async (doc) => toConversationDto(doc, userId, await unreadCountFor(doc, userId))),
  );

  return paginated(items, total, page, limit);
}

/** Opening a chat from the Contacts screen reuses the existing thread. */
export async function getOrCreateDirectConversation(userId, otherUserId) {
  if (userId === otherUserId) throw ApiError.badRequest('You cannot chat with yourself');

  const other = await User.findById(otherUserId);
  if (!other) throw ApiError.notFound('That person could not be found');

  const existing = await Conversation.findOne({
    type: ConversationType.Direct,
    participants: { $all: [userId, otherUserId], $size: 2 },
  }).populate(CONVERSATION_POPULATE);

  if (existing) {
    return toConversationDto(existing, userId, await unreadCountFor(existing, userId));
  }

  const conversation = await Conversation.create({
    type: ConversationType.Direct,
    participants: [userId, otherUserId],
    createdBy: userId,
  });

  await conversation.populate(CONVERSATION_POPULATE);
  return toConversationDto(conversation, userId, 0);
}

export async function createGroupConversation(userId, participantIds, title) {
  const unique = [...new Set([userId, ...participantIds])];
  if (unique.length < 3) throw ApiError.badRequest('A group needs at least three people');

  const found = await User.countDocuments({ _id: { $in: unique } });
  if (found !== unique.length) throw ApiError.badRequest('One or more people could not be found');

  const conversation = await Conversation.create({
    type: ConversationType.Group,
    title: title ?? 'New group',
    participants: unique,
    createdBy: userId,
  });

  await conversation.populate(CONVERSATION_POPULATE);
  return toConversationDto(conversation, userId, 0);
}

/** The in-meeting chat panel writes into a conversation owned by the meeting. */
export async function ensureMeetingConversation(meetingId, title, participantIds) {
  const existing = await Conversation.findOne({ meeting: meetingId });
  if (existing) {
    const known = new Set(existing.participants.map((id) => id.toString()));
    const additions = participantIds.filter((id) => id && !known.has(String(id)));
    if (additions.length) {
      existing.participants.push(...additions.map((id) => new Types.ObjectId(String(id))));
      await existing.save();
    }
    return existing;
  }

  return Conversation.create({
    type: ConversationType.Meeting,
    title,
    meeting: meetingId,
    participants: participantIds,
  });
}

export async function listMessages(conversationId, userId, query) {
  await assertMember(conversationId, userId);
  const { page, limit, skip } = resolvePagination(query, 40);

  const filter = { conversation: conversationId };
  if (query.before) filter.createdAt = { $lt: new Date(query.before) };

  const [docs, total] = await Promise.all([
    Message.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(MESSAGE_POPULATE),
    Message.countDocuments(filter),
  ]);

  // Newest-first from Mongo, oldest-first for rendering.
  return paginated(docs.reverse().map(toMessageDto), total, page, limit);
}

export async function sendMessage(conversationId, senderId, input) {
  const conversation = await assertMember(conversationId, senderId);

  const attachments = await resolveAttachments(senderId, input.attachmentIds);
  const body = (input.body ?? '').trim();

  if (!body && attachments.length === 0) {
    throw ApiError.badRequest('Write a message or attach a file');
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: senderId,
    type: input.type ?? (attachments.length ? MessageType.File : MessageType.Text),
    body,
    attachments,
    readBy: [senderId],
  });

  conversation.lastMessage = message._id;
  conversation.lastMessageAt = message.createdAt;
  conversation.lastReadAt.set(senderId, message.createdAt);
  await conversation.save();

  await message.populate(MESSAGE_POPULATE);
  return toMessageDto(message);
}

export async function markRead(conversationId, userId, messageId) {
  const conversation = await assertMember(conversationId, userId);

  const readAt = messageId
    ? ((await Message.findById(messageId))?.createdAt ?? new Date())
    : new Date();

  conversation.lastReadAt.set(userId, readAt);
  await conversation.save();

  if (messageId) {
    await Message.updateOne({ _id: messageId }, { $addToSet: { readBy: userId } });
  }
}

export async function getConversation(conversationId, userId) {
  const conversation = await assertMember(conversationId, userId);
  return toConversationDto(conversation, userId, await unreadCountFor(conversation, userId));
}
