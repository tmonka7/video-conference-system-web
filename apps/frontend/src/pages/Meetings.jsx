import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MeetingListFilter,
  MeetingStatus,
  formatDate,
  formatMeetingId,
  formatTimeRange,
} from '@vcs/shared';
import { meetingsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, EmptyState, PageLoader, Tabs } from '@/components/ui';
import { CopyIcon, MoreIcon, PlusIcon } from '@/components/icons';
import ScheduleMeetingModal from '@/components/ScheduleMeetingModal';

const TABS = [
  { value: MeetingListFilter.Upcoming, label: 'Upcoming' },
  { value: MeetingListFilter.Past, label: 'Past' },
  { value: MeetingListFilter.All, label: 'All' },
];

const STATUS_TONE = {
  [MeetingStatus.Live]: 'green',
  [MeetingStatus.Scheduled]: 'blue',
  [MeetingStatus.Ended]: 'slate',
  [MeetingStatus.Cancelled]: 'red',
};

function MeetingRow({ meeting, isHost, onJoin, onEdit, onCancel, onCopy }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const live = meeting.status === MeetingStatus.Live;
  const finished =
    meeting.status === MeetingStatus.Ended || meeting.status === MeetingStatus.Cancelled;

  return (
    <div className="card flex flex-wrap items-center gap-4 px-5 py-4 sm:flex-nowrap">
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${live ? 'bg-emerald-500' : 'bg-slate-300'}`}
        title={meeting.status}
      />

      <span className="w-32 shrink-0 text-sm font-semibold text-slate-700">
        {formatTimeRange(meeting.scheduledStart, meeting.scheduledEnd)}
        <span className="block text-xs font-normal text-slate-400">
          {formatDate(meeting.scheduledStart)}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-bold text-slate-900">{meeting.title}</span>
          {live && <Badge tone={STATUS_TONE[meeting.status]}>Live</Badge>}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
          Meeting ID: {formatMeetingId(meeting.meetingId)}
          <button
            type="button"
            onClick={() => onCopy(meeting)}
            className="rounded p-1 hover:bg-slate-100"
            aria-label="Copy invite link"
          >
            <CopyIcon className="h-3.5 w-3.5" />
          </button>
        </span>
      </span>

      {!finished && (
        <Button size="sm" onClick={() => onJoin(meeting)}>
          Join
        </Button>
      )}

      {isHost && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="More actions"
          >
            <MoreIcon />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-card">
                {!finished && (
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(meeting);
                    }}
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setMenuOpen(false);
                    onCancel(meeting);
                  }}
                >
                  {finished ? 'Delete' : 'Cancel'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Screen 4: the Meetings list with Upcoming / Past / All tabs. */
export default function Meetings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const filter = searchParams.get('filter') ?? MeetingListFilter.Upcoming;
  const search = searchParams.get('search') ?? '';

  const [meetings, setMeetings] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setMeetings(null);
    try {
      const page = await meetingsApi.list({ filter, search, limit: 50 });
      setMeetings(page.items);
    } catch (error) {
      toast.error(error.message);
      setMeetings([]);
    }
  }, [filter, search, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const copyInvite = async (meeting) => {
    try {
      await navigator.clipboard.writeText(meeting.joinUrl);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const cancelMeeting = async (meeting) => {
    const finished =
      meeting.status === MeetingStatus.Ended || meeting.status === MeetingStatus.Cancelled;
    try {
      if (finished) {
        await meetingsApi.remove(meeting.id);
        toast.success('Meeting deleted');
      } else {
        await meetingsApi.cancel(meeting.id);
        toast.success('Meeting cancelled');
      }
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-slate-900">Meetings</h1>
        <Button onClick={() => setScheduling(true)}>
          <PlusIcon className="h-4 w-4" />
          Schedule
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Tabs
          tabs={TABS}
          value={filter}
          onChange={(value) => setSearchParams(search ? { filter: value, search } : { filter: value })}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearchParams({ filter })}
            className="text-sm text-slate-500 underline"
          >
            Clear search “{search}”
          </button>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {meetings === null ? (
          <PageLoader label="Loading meetings" />
        ) : meetings.length === 0 ? (
          <EmptyState
            title="No meetings here"
            description={
              filter === MeetingListFilter.Past
                ? 'Meetings you have finished will show up here.'
                : 'Schedule one, or start an instant meeting from the home screen.'
            }
            action={<Button onClick={() => setScheduling(true)}>Schedule a meeting</Button>}
          />
        ) : (
          meetings.map((meeting) => (
            <MeetingRow
              key={meeting.id}
              meeting={meeting}
              isHost={meeting.host.id === user?.id}
              onJoin={(target) => navigate(`/meeting/${target.meetingId}`)}
              onEdit={setEditing}
              onCancel={cancelMeeting}
              onCopy={copyInvite}
            />
          ))
        )}
      </div>

      <ScheduleMeetingModal
        open={scheduling}
        onClose={() => setScheduling(false)}
        onCreated={() => {
          setScheduling(false);
          load();
        }}
      />
      <ScheduleMeetingModal
        open={Boolean(editing)}
        meeting={editing}
        onClose={() => setEditing(null)}
        onCreated={() => {
          setEditing(null);
          load();
        }}
      />
    </div>
  );
}
