import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContactStatus, ConversationType, presenceLabel } from '@vcs/shared';
import { chatApi, contactsApi, meetingsApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { Avatar, Badge, Button, EmptyState, Input, Modal, PageLoader, PresenceDot } from '@/components/ui';
import { ChatIcon, PlusIcon, SearchIcon, StarIcon, TrashIcon, VideoIcon } from '@/components/icons';

/** Screen 9: the Contacts directory. */
export default function Contacts() {
  const navigate = useNavigate();
  const toast = useToast();

  const [contacts, setContacts] = useState(null);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(
    async (term = '') => {
      try {
        const page = await contactsApi.list({ search: term, limit: 100 });
        setContacts(page.items);
      } catch (error) {
        toast.error(error.message);
        setContacts([]);
      }
    },
    [toast],
  );

  useEffect(() => {
    const timer = setTimeout(() => load(search), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, load]);

  const addContact = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await contactsApi.add(identifier);
      toast.success('Invitation sent');
      setAdding(false);
      setIdentifier('');
      load(search);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const act = async (action, successMessage) => {
    try {
      await action();
      if (successMessage) toast.success(successMessage);
      load(search);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const startChat = async (contact) => {
    try {
      const conversation = await chatApi.createConversation({
        type: ConversationType.Direct,
        participantIds: [contact.user.id],
      });
      navigate(`/app/chat/${conversation.id}`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const startCall = async (contact) => {
    try {
      const meeting = await meetingsApi.instant({ title: `Call with ${contact.user.name}` });
      await meetingsApi.invite(meeting.id, [contact.user.id]);
      navigate(`/meeting/${meeting.meetingId}`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-slate-900">Contacts</h1>
        <Button onClick={() => setAdding(true)}>
          <PlusIcon className="h-4 w-4" />
          Add Contact
        </Button>
      </div>

      <div className="relative mt-6">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Search contacts…"
          className="field pl-11"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="mt-6">
        {contacts === null ? (
          <PageLoader label="Loading contacts" />
        ) : contacts.length === 0 ? (
          <EmptyState
            title="No contacts yet"
            description="Add people by their email address or phone number to start calling them."
            action={<Button onClick={() => setAdding(true)}>Add your first contact</Button>}
          />
        ) : (
          <ul className="card divide-y divide-slate-100">
            {contacts.map((contact) => (
              <li key={contact.id} className="flex items-center gap-4 px-5 py-4">
                <span className="relative">
                  <Avatar user={contact.user} size="md" />
                  <PresenceDot
                    presence={contact.user.presence}
                    className="absolute -bottom-0.5 -right-0.5 ring-2 ring-white"
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-slate-900">
                      {contact.user.name}
                    </span>
                    {contact.status === ContactStatus.Pending && (
                      <Badge tone="amber">{contact.incoming ? 'Invited you' : 'Pending'}</Badge>
                    )}
                    {contact.status === ContactStatus.Blocked && <Badge tone="red">Blocked</Badge>}
                  </span>
                  <span className="block truncate text-sm text-slate-500">
                    {presenceLabel(contact.user.presence)}
                  </span>
                </span>

                <span className="flex items-center gap-1">
                  {contact.status === ContactStatus.Pending && contact.incoming && (
                    <Button
                      size="sm"
                      onClick={() => act(() => contactsApi.accept(contact.id), 'Contact accepted')}
                    >
                      Accept
                    </Button>
                  )}

                  <button
                    type="button"
                    aria-label={contact.favorite ? 'Remove from favourites' : 'Add to favourites'}
                    onClick={() => act(() => contactsApi.favorite(contact.id, !contact.favorite))}
                    className={`rounded-lg p-2 hover:bg-slate-100 ${
                      contact.favorite ? 'text-amber-500' : 'text-slate-300'
                    }`}
                  >
                    <StarIcon filled={contact.favorite} />
                  </button>

                  <button
                    type="button"
                    aria-label={`Message ${contact.user.name}`}
                    onClick={() => startChat(contact)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                  >
                    <ChatIcon />
                  </button>

                  <button
                    type="button"
                    aria-label={`Call ${contact.user.name}`}
                    onClick={() => startCall(contact)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                  >
                    <VideoIcon />
                  </button>

                  <button
                    type="button"
                    aria-label={`Remove ${contact.user.name}`}
                    onClick={() => act(() => contactsApi.remove(contact.id), 'Contact removed')}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <TrashIcon />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add Contact"
        footer={
          <>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button form="add-contact" type="submit" loading={submitting}>
              Send invitation
            </Button>
          </>
        }
      >
        <form id="add-contact" onSubmit={addContact}>
          <Input
            label="Email or phone number"
            name="identifier"
            placeholder="sarah@company.com"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            hint="They will see the invitation in their own Contacts screen."
            required
          />
        </form>
      </Modal>
    </div>
  );
}
