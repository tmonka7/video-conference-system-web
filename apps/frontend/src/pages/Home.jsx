import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MeetingListFilter, formatMeetingId, formatTimeRange } from '@vcs/shared';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { meetingsApi } from '@/lib/api';
import { Button, PageLoader } from '@/components/ui';
import { CalendarIcon, PlusIcon, ScreenIcon, VideoIcon } from '@/components/icons';
import ScheduleMeetingModal from '@/components/ScheduleMeetingModal';

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function ActionCard({ icon: Icon, label, tone, onClick }) {
  const tones = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    blue: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
    indigo: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    green: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex aspect-[2/1] flex-col items-center justify-center gap-4 rounded-2xl text-lg font-bold transition ${tones[tone]}`}
    >
      <Icon className="h-10 w-10" />
      {label}
    </button>
  );
}

/** Screen 3: the signed-in landing page. */
export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [upcoming, setUpcoming] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    meetingsApi
      .list({ filter: MeetingListFilter.Upcoming, limit: 3 })
      .then((page) => !cancelled && setUpcoming(page.items))
      .catch(() => !cancelled && setUpcoming([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const startMeeting = async (options = {}) => {
    setStarting(true);
    try {
      const meeting = await meetingsApi.instant({});
      // `share` tells the room to open the picker as soon as it is connected.
      navigate(`/meeting/${meeting.meetingId}`, { state: options });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setStarting(false);
    }
  };

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
        {greeting()}, {firstName}
      </h1>
      <p className="mt-2 text-slate-500">Let&apos;s make great things happen today.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ActionCard
          icon={VideoIcon}
          label={starting ? 'Starting…' : 'Start Meeting'}
          tone="primary"
          onClick={() => startMeeting()}
        />
        <ActionCard
          icon={PlusIcon}
          label="Join Meeting"
          tone="blue"
          onClick={() => navigate('/join')}
        />
        <ActionCard
          icon={CalendarIcon}
          label="Schedule"
          tone="indigo"
          onClick={() => setScheduling(true)}
        />
        <ActionCard
          icon={ScreenIcon}
          label="Share Screen"
          tone="green"
          onClick={() => startMeeting({ shareOnJoin: true })}
        />
      </div>

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Up next</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/meetings')}>
            View all
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {upcoming === null ? (
            <PageLoader label="Loading meetings" />
          ) : upcoming.length === 0 ? (
            <p className="rounded-2xl bg-white px-6 py-8 text-center text-sm text-slate-500">
              Nothing scheduled. Enjoy the quiet.
            </p>
          ) : (
            upcoming.map((meeting) => (
              <div
                key={meeting.id}
                className="card flex flex-wrap items-center gap-4 px-5 py-4 sm:flex-nowrap"
              >
                <span className="w-32 shrink-0 text-sm font-semibold text-slate-700">
                  {formatTimeRange(meeting.scheduledStart, meeting.scheduledEnd)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-slate-900">{meeting.title}</span>
                  <span className="block text-sm text-slate-500">
                    Meeting ID: {formatMeetingId(meeting.meetingId)}
                  </span>
                </span>
                <Button size="sm" onClick={() => navigate(`/meeting/${meeting.meetingId}`)}>
                  Join
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      <ScheduleMeetingModal
        open={scheduling}
        onClose={() => setScheduling(false)}
        onCreated={() => {
          setScheduling(false);
          navigate('/app/meetings');
        }}
      />
    </div>
  );
}
