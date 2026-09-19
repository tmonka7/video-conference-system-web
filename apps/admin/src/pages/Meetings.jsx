import { useCallback, useEffect, useState } from 'react';
import { MeetingListFilter, MeetingStatus, formatDate, formatMeetingId, formatTimeRange } from '@vcs/shared';
import { adminApi } from '@/lib/api';
import { Badge, Button, Card, EmptyRow, Input, Loading, Pagination } from '@/components/ui';

const STATUS_TONE = {
  [MeetingStatus.Live]: 'green',
  [MeetingStatus.Scheduled]: 'blue',
  [MeetingStatus.Ended]: 'slate',
  [MeetingStatus.Cancelled]: 'red',
};

export default function Meetings() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await adminApi.meetings({ page, limit: 20, search, filter: MeetingListFilter.All }));
    } catch (apiError) {
      setError(apiError.message);
      setData({ items: [], meta: null });
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const endMeeting = async (meeting) => {
    setBusy(true);
    try {
      await adminApi.endMeeting(meeting.id);
      await load();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-slate-900">Meetings</h1>

      <Card className="p-4">
        <Input
          name="search"
          placeholder="Search by title"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
      </Card>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <Card className="overflow-hidden">
        {data === null ? (
          <Loading label="Loading meetings" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Meeting</th>
                    <th className="px-5 py-3 font-medium">Host</th>
                    <th className="hidden px-5 py-3 font-medium md:table-cell">When</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">In room</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.length === 0 ? (
                    <EmptyRow colSpan={6}>No meetings found.</EmptyRow>
                  ) : (
                    data.items.map((meeting) => (
                      <tr key={meeting.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-800">{meeting.title}</p>
                          <p className="text-xs text-slate-500">
                            ID {formatMeetingId(meeting.meetingId)}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{meeting.host.name}</td>
                        <td className="hidden px-5 py-3 text-slate-500 md:table-cell">
                          {formatDate(meeting.scheduledStart)}
                          <span className="block text-xs">
                            {formatTimeRange(meeting.scheduledStart, meeting.scheduledEnd)}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={STATUS_TONE[meeting.status]}>{meeting.status}</Badge>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{meeting.participantCount}</td>
                        <td className="px-5 py-3 text-right">
                          {meeting.status === MeetingStatus.Live && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              disabled={busy}
                              onClick={() => endMeeting(meeting)}
                            >
                              Force end
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination meta={data.meta} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
