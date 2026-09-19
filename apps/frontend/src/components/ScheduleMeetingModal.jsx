import { useEffect, useMemo, useState } from 'react';
import { RecurrenceFrequency } from '@vcs/shared';
import { ApiError, meetingsApi, usersApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { Avatar, Button, Input, Modal, Toggle } from '@/components/ui';

/** Local `YYYY-MM-DD` and `HH:mm`, for the date and time inputs. */
function defaultSlot() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 3_600_000);

  const date = (value) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const time = (value) =>
    `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;

  return { date: date(start), start: time(start), end: time(end) };
}

function toIso(date, time) {
  // Building from parts keeps the user's own timezone.
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

/** Screen 11: "Schedule Meeting". */
export default function ScheduleMeetingModal({ open, onClose, onCreated, meeting }) {
  const toast = useToast();
  const slot = useMemo(defaultSlot, []);

  const [form, setForm] = useState({ title: '', ...slot, passcode: '', recurring: false });
  const [participants, setParticipants] = useState([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Reopening the dialog should not show the previous attempt's state.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSearch('');
    setResults([]);

    if (meeting) {
      const start = new Date(meeting.scheduledStart);
      const end = new Date(meeting.scheduledEnd);
      const pad = (n) => String(n).padStart(2, '0');
      setForm({
        title: meeting.title,
        date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
        start: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
        end: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
        passcode: '',
        recurring: Boolean(meeting.recurrence),
      });
      setParticipants(meeting.invitees ?? []);
    } else {
      setForm({ title: '', ...defaultSlot(), passcode: '', recurring: false });
      setParticipants([]);
    }
  }, [open, meeting]);

  // Debounced people search for the participant picker.
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      usersApi
        .search({ search, limit: 6 })
        .then((page) => setResults(page.items))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const addParticipant = (person) => {
    setParticipants((current) =>
      current.some((entry) => entry.id === person.id) ? current : [...current, person],
    );
    setSearch('');
    setResults([]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setSubmitting(true);

    const payload = {
      title: form.title,
      scheduledStart: toIso(form.date, form.start),
      scheduledEnd: toIso(form.date, form.end),
      inviteeIds: participants.map((person) => person.id),
      ...(form.passcode ? { passcode: form.passcode } : {}),
      ...(form.recurring
        ? { recurrence: { frequency: RecurrenceFrequency.Weekly, interval: 1 } }
        : {}),
    };

    try {
      const saved = meeting
        ? await meetingsApi.update(meeting.id, payload)
        : await meetingsApi.create(payload);
      toast.success(meeting ? 'Meeting updated' : 'Meeting scheduled');
      onCreated?.(saved);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? {});
        if (!error.details) toast.error(error.message);
      } else {
        toast.error('Could not save the meeting');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={meeting ? 'Edit Meeting' : 'Schedule Meeting'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="schedule-form" type="submit" loading={submitting}>
            {meeting ? 'Save changes' : 'Schedule'}
          </Button>
        </>
      }
    >
      <form id="schedule-form" className="space-y-5" onSubmit={handleSubmit} noValidate>
        <Input
          label="Meeting Title"
          name="title"
          placeholder="Weekly Team Meeting"
          value={form.title}
          onChange={update('title')}
          error={errors.title?.[0]}
          required
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Date"
            name="date"
            type="date"
            value={form.date}
            onChange={update('date')}
            error={errors.scheduledStart?.[0]}
            required
          />
          <Input
            label="From"
            name="start"
            type="time"
            value={form.start}
            onChange={update('start')}
            required
          />
          <Input
            label="To"
            name="end"
            type="time"
            value={form.end}
            onChange={update('end')}
            error={errors.scheduledEnd?.[0]}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="participants">
            Participants
          </label>
          <input
            id="participants"
            className="field"
            placeholder="Add participants"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
          />

          {results.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {results.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => addParticipant(person)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                  >
                    <Avatar user={person} size="xs" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{person.name}</span>
                      <span className="block truncate text-xs text-slate-500">{person.email}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {participants.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {participants.map((person) => (
                <span
                  key={person.id}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-50 py-1.5 pl-3 pr-2 text-sm font-medium text-brand-700"
                >
                  {person.name}
                  <button
                    type="button"
                    aria-label={`Remove ${person.name}`}
                    onClick={() =>
                      setParticipants((current) =>
                        current.filter((entry) => entry.id !== person.id),
                      )
                    }
                    className="rounded-full p-0.5 hover:bg-brand-100"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6.3 6.3a1 1 0 011.4 0L10 8.6l2.3-2.3a1 1 0 111.4 1.4L11.4 10l2.3 2.3a1 1 0 01-1.4 1.4L10 11.4l-2.3 2.3a1 1 0 01-1.4-1.4L8.6 10 6.3 7.7a1 1 0 010-1.4z" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <Input
          label="Passcode (optional)"
          name="passcode"
          placeholder="Leave empty for no passcode"
          value={form.passcode}
          onChange={update('passcode')}
          error={errors.passcode?.[0]}
        />

        <Toggle
          label="Recurring Meeting"
          description="Repeats weekly at the same time."
          checked={form.recurring}
          onChange={(recurring) => setForm((current) => ({ ...current, recurring }))}
        />
      </form>
    </Modal>
  );
}
