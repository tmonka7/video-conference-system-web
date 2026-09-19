/**
 * Seeds the database with the people, meetings and chats shown in the UI
 * mockups, so the two web apps have something realistic to render.
 *
 *   npm run seed
 *
 * Every account uses the password "Password123".
 */
import {
  ContactStatus,
  ConversationType,
  DEFAULT_MEETING_SETTINGS,
  DEFAULT_USER_SETTINGS,
  MeetingRole,
  MeetingStatus,
  MessageType,
  PresenceStatus,
  UserRole,
} from '@vcs/shared';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './db/connect.js';
import { Contact } from './models/Contact.js';
import { Conversation } from './models/Conversation.js';
import { Meeting } from './models/Meeting.js';
import { Message } from './models/Message.js';
import { User } from './models/User.js';
import { generateMeetingId } from './utils/meetingId.js';
import { hashPassword } from './utils/password.js';

const PASSWORD = 'Password123';

const PEOPLE = [
  { name: 'Alex Chen', email: 'alex@company.com', presence: PresenceStatus.Online },
  { name: 'Sarah Wilson', email: 'sarah@company.com', presence: PresenceStatus.Online },
  { name: 'Michael Brown', email: 'michael@company.com', presence: PresenceStatus.Online },
  { name: 'Emily Davis', email: 'emily@company.com', presence: PresenceStatus.InMeeting },
  { name: 'David Lee', email: 'david@company.com', presence: PresenceStatus.Offline },
  { name: 'Lisa Wang', email: 'lisa@company.com', presence: PresenceStatus.Offline },
  { name: 'James Wilson', email: 'james@company.com', presence: PresenceStatus.Offline },
];

const SCHEDULE = [
  { title: 'Project Kickoff Meeting', hour: 9 },
  { title: 'Design Review', hour: 11 },
  { title: 'Marketing Update', hour: 14 },
  { title: 'Team Sync', hour: 16 },
];

/** Today at the given hour, in the server's timezone. */
function todayAt(hour) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function seed() {
  await connectDatabase();

  logger.info('Clearing existing demo data');
  await Promise.all([
    User.deleteMany({}),
    Meeting.deleteMany({}),
    Contact.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
  ]);

  const passwordHash = await hashPassword(PASSWORD);

  const admin = await User.create({
    name: 'System Administrator',
    email: 'admin@company.com',
    passwordHash,
    role: UserRole.SuperAdmin,
    emailVerified: true,
    settings: { ...DEFAULT_USER_SETTINGS },
  });

  const users = await User.create(
    PEOPLE.map((person) => ({
      ...person,
      passwordHash,
      role: UserRole.User,
      emailVerified: true,
      settings: { ...DEFAULT_USER_SETTINGS },
    })),
  );

  const [alex, sarah, michael, emily] = users;

  logger.info('Creating contacts for Alex');
  await Contact.insertMany(
    users
      .filter((user) => !user._id.equals(alex._id))
      .flatMap((user) => [
        {
          owner: alex._id,
          contact: user._id,
          status: ContactStatus.Accepted,
          favorite: user._id.equals(sarah._id),
          incoming: false,
        },
        {
          owner: user._id,
          contact: alex._id,
          status: ContactStatus.Accepted,
          favorite: false,
          incoming: true,
        },
      ]),
  );

  logger.info('Creating meetings');
  for (const entry of SCHEDULE) {
    await Meeting.create({
      meetingId: generateMeetingId(),
      title: entry.title,
      host: alex._id,
      status: MeetingStatus.Scheduled,
      scheduledStart: todayAt(entry.hour),
      scheduledEnd: todayAt(entry.hour + 1),
      settings: { ...DEFAULT_MEETING_SETTINGS },
      invitees: [sarah._id, michael._id, emily._id],
      participants: [
        {
          user: alex._id,
          displayName: alex.name,
          role: MeetingRole.Host,
          media: {
            audioEnabled: true,
            videoEnabled: true,
            screenSharing: false,
            handRaised: false,
          },
          isOnline: false,
        },
      ],
    });
  }

  // One meeting last week, so the "Past" tab is not empty.
  const lastWeek = new Date(Date.now() - 7 * 86_400_000);
  await Meeting.create({
    meetingId: generateMeetingId(),
    title: 'Quarterly Planning',
    host: alex._id,
    status: MeetingStatus.Ended,
    scheduledStart: lastWeek,
    scheduledEnd: new Date(lastWeek.getTime() + 3_600_000),
    startedAt: lastWeek,
    endedAt: new Date(lastWeek.getTime() + 52 * 60_000),
    settings: { ...DEFAULT_MEETING_SETTINGS },
    invitees: [sarah._id, michael._id],
  });

  logger.info('Creating conversations');
  const direct = await Conversation.create({
    type: ConversationType.Direct,
    participants: [alex._id, sarah._id],
    createdBy: sarah._id,
  });

  await Message.create({
    conversation: direct._id,
    sender: sarah._id,
    type: MessageType.Text,
    body: 'Hi Alex, are you available for the meeting at 10 AM?',
    readBy: [sarah._id],
  });

  const reply = await Message.create({
    conversation: direct._id,
    sender: alex._id,
    type: MessageType.Text,
    body: "Yes, I'll be there!",
    readBy: [alex._id, sarah._id],
  });

  direct.lastMessage = reply._id;
  direct.lastMessageAt = reply.createdAt;
  await direct.save();

  const group = await Conversation.create({
    type: ConversationType.Group,
    title: 'Project Team',
    participants: [alex._id, sarah._id, michael._id, emily._id],
    createdBy: alex._id,
  });

  const groupMessage = await Message.create({
    conversation: group._id,
    sender: michael._id,
    type: MessageType.Text,
    body: "I've updated the doc.",
    readBy: [michael._id],
  });

  group.lastMessage = groupMessage._id;
  group.lastMessageAt = groupMessage.createdAt;
  await group.save();

  logger.info(
    { admin: admin.email, users: users.length, meetings: SCHEDULE.length + 1 },
    `Seed complete. Every account uses the password "${PASSWORD}".`,
  );

  await disconnectDatabase();
}

seed().catch((error) => {
  logger.fatal({ err: error }, 'Seeding failed');
  process.exit(1);
});
