import { useEffect, useState } from 'react';
import { formatBytes } from '@vcs/shared';
import { adminApi } from '@/lib/api';
import { Card, Loading } from '@/components/ui';
import TrendChart from '@/components/TrendChart';

/** A headline number needs no chart; these are stat tiles, not plots. */
function Stat({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900',
    blue: 'text-brand-700',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
  };

  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold ${tones[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminApi
      .overview(7)
      .then((data) => !cancelled && setOverview(data))
      .catch((apiError) => !cancelled && setError(apiError.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  if (!overview) return <Loading label="Loading dashboard" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total users"
          value={overview.users.total}
          sub={`${overview.users.newThisWeek} joined this week`}
        />
        <Stat
          label="Online now"
          value={overview.users.onlineNow}
          tone="green"
          sub={`${overview.users.suspended} suspended`}
        />
        <Stat
          label="Live meetings"
          value={overview.meetings.live}
          tone="blue"
          sub={`${overview.meetings.scheduledToday} scheduled today`}
        />
        <Stat
          label="Avg. duration"
          value={`${overview.meetings.averageDurationMinutes}m`}
          sub={`${overview.meetings.endedThisWeek} ended this week`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <TrendChart
            title="Meetings per day"
            data={overview.trend}
            valueKey="meetings"
            unit="meetings"
          />
        </Card>
        <Card className="p-5">
          <TrendChart
            title="Participants per day"
            data={overview.trend}
            valueKey="participants"
            unit="participants"
          />
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Files stored" value={overview.storage.files} />
        <Stat label="Storage used" value={formatBytes(overview.storage.totalBytes)} />
      </div>
    </div>
  );
}
