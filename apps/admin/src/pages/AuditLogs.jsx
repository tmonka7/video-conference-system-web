import { useCallback, useEffect, useState } from 'react';
import { formatChatTimestamp } from '@vcs/shared';
import { adminApi } from '@/lib/api';
import { Card, EmptyRow, Input, Loading, Pagination } from '@/components/ui';

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await adminApi.auditLogs({ page, limit: 30, action: action || undefined }));
    } catch (apiError) {
      setError(apiError.message);
      setData({ items: [], meta: null });
    }
  }, [page, action]);

  useEffect(() => {
    const timer = setTimeout(load, action ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, action]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-slate-900">Audit log</h1>

      <Card className="p-4">
        <Input
          name="action"
          placeholder="Filter by action, e.g. admin.user_updated"
          value={action}
          onChange={(event) => {
            setPage(1);
            setAction(event.target.value);
          }}
          hint="Exact match. Leave empty to see everything."
        />
      </Card>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <Card className="overflow-hidden">
        {data === null ? (
          <Loading label="Loading audit log" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">When</th>
                    <th className="px-5 py-3 font-medium">Actor</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                    <th className="hidden px-5 py-3 font-medium lg:table-cell">Target</th>
                    <th className="hidden px-5 py-3 font-medium lg:table-cell">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.length === 0 ? (
                    <EmptyRow colSpan={5}>Nothing recorded yet.</EmptyRow>
                  ) : (
                    data.items.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                          {formatChatTimestamp(log.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-slate-700">
                          {log.actor?.name ?? <span className="text-slate-400">system</span>}
                        </td>
                        <td className="px-5 py-3">
                          <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            {log.action}
                          </code>
                        </td>
                        <td className="hidden px-5 py-3 text-xs text-slate-500 lg:table-cell">
                          {log.targetType ? `${log.targetType} ${log.targetId ?? ''}` : '—'}
                        </td>
                        <td className="hidden px-5 py-3 text-xs text-slate-400 lg:table-cell">
                          {log.ip ?? '—'}
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
