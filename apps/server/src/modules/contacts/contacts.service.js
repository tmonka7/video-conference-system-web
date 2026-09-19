import { ContactStatus, UserStatus } from '@vcs/shared';
import { idOf, toContactDto } from '../../mappers/index.js';
import { Contact } from '../../models/Contact.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, resolvePagination } from '../../utils/pagination.js';
import { paginated } from '../../utils/response.js';

const POPULATE = 'contact';

export async function listContacts(ownerId, query) {
  const { page, limit, skip } = resolvePagination(query, 50);

  const filter = { owner: ownerId };
  if (query.status) filter.status = query.status;
  if (query.favoritesOnly) filter.favorite = true;

  if (query.search) {
    // The searchable fields live on User, so resolve ids first.
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    const matches = await User.find({ $or: [{ name: pattern }, { email: pattern }] })
      .select('_id')
      .limit(200);
    filter.contact = { $in: matches.map((match) => match._id) };
  }

  const [docs, total] = await Promise.all([
    Contact.find(filter)
      .sort({ favorite: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(POPULATE),
    Contact.countDocuments(filter),
  ]);

  return paginated(docs.map(toContactDto), total, page, limit);
}

/**
 * Sends an invitation. The inviter gets a pending row and the recipient gets an
 * `incoming` row they can accept from the Contacts screen.
 */
export async function addContact(ownerId, identifier) {
  const value = identifier.trim();
  const target = await User.findOne({
    $or: [{ email: value.toLowerCase() }, { phone: value }],
    status: UserStatus.Active,
  });

  if (!target) throw ApiError.notFound('No account found for that email or phone number');
  if (target._id.toString() === ownerId) {
    throw ApiError.badRequest('You cannot add yourself as a contact');
  }

  const existing = await Contact.findOne({ owner: ownerId, contact: target._id });
  if (existing) {
    if (existing.status === ContactStatus.Blocked) {
      throw ApiError.conflict('This contact is blocked');
    }
    throw ApiError.conflict('This person is already in your contacts');
  }

  const [outgoing] = await Promise.all([
    Contact.create({
      owner: ownerId,
      contact: target._id,
      status: ContactStatus.Pending,
      incoming: false,
    }),
    Contact.updateOne(
      { owner: target._id, contact: ownerId },
      {
        $setOnInsert: {
          owner: target._id,
          contact: ownerId,
          status: ContactStatus.Pending,
          incoming: true,
        },
      },
      { upsert: true },
    ),
  ]);

  await outgoing.populate(POPULATE);
  return toContactDto(outgoing);
}

async function loadOwned(ownerId, contactId) {
  const contact = await Contact.findOne({ _id: contactId, owner: ownerId }).populate(POPULATE);
  if (!contact) throw ApiError.notFound('Contact not found');
  return contact;
}

/** Accepting flips both sides to accepted, so each can call the other. */
export async function acceptContact(ownerId, contactId) {
  const contact = await loadOwned(ownerId, contactId);
  if (contact.status === ContactStatus.Accepted) return toContactDto(contact);
  if (contact.status === ContactStatus.Blocked) {
    throw ApiError.badRequest('Unblock this contact before accepting');
  }

  contact.status = ContactStatus.Accepted;
  await contact.save();

  await Contact.updateOne(
    { owner: idOf(contact.contact), contact: ownerId },
    { status: ContactStatus.Accepted },
  );

  return toContactDto(contact);
}

export async function setFavorite(ownerId, contactId, favorite) {
  const contact = await loadOwned(ownerId, contactId);
  contact.favorite = favorite;
  await contact.save();
  return toContactDto(contact);
}

export async function blockContact(ownerId, contactId) {
  const contact = await loadOwned(ownerId, contactId);
  contact.status = ContactStatus.Blocked;
  contact.favorite = false;
  await contact.save();
  return toContactDto(contact);
}

export async function removeContact(ownerId, contactId) {
  const contact = await loadOwned(ownerId, contactId);
  const otherId = idOf(contact.contact);

  await contact.deleteOne();
  // Drop the mirrored row only while it is still pending.
  await Contact.deleteOne({ owner: otherId, contact: ownerId, status: ContactStatus.Pending });
}
