import { useCallback, useEffect, useState } from 'react';
import { UserRole, UserStatus, formatDate, valuesOf } from '@vcs/shared';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyRow,
  Input,
  Loading,
  Modal,
  Pagination,
  Select,
} from '@/components/ui';

const STATUS_TONE = {
  [UserStatus.Active]: 'green',
  [UserStatus.Suspended]: 'amber',
  [UserStatus.Deleted]: 'red',
};

const ROLE_LABEL = {
  [UserRole.User]: 'User',
  [UserRole.Admin]: 'Admin',
  [UserRole.SuperAdmin]: 'Super admin',
};

export default function Users() {
  const { admin, isSuperAdmin } = useAuth();

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: UserRole.User });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await adminApi.users({ page, limit: 20, ...filters }));
    } catch (apiError) {
      setError(apiError.message);
      setData({ items: [], meta: null });
    }
  }, [page, filters]);

  useEffect(() => {
    const timer = setTimeout(load, filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, filters.search]);

  const patch = async (user, changes) => {
    setBusy(true);
    setError('');
    try {
      await adminApi.updateUser(user.id, changes);
      await load();
      setEditing(null);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setBusy(false);
    }
  };

  const createUser = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminApi.createUser(form);
      setCreating(false);
      setForm({ name: '', email: '', password: '', role: UserRole.User });
      await load();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (user) => {
    setBusy(true);
    try {
      await adminApi.deleteUser(user.id);
      await load();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900">Users</h1>
        <Button onClick={() => setCreating(true)}>Add user</Button>
      </div>

      <Card className="flex flex-wrap gap-3 p-4">
        <Input
          name="search"
          placeholder="Search name, email or phone"
          className="min-w-[220px] flex-1"
          value={filters.search}
          onChange={(event) => {
            setPage(1);
            setFilters({ ...filters, search: event.target.value });
          }}
        />
        <Select
          name="role"
          className="w-40"
          value={filters.role}
          onChange={(event) => {
            setPage(1);
            setFilters({ ...filters, role: event.target.value });
          }}
        >
          <option value="">All roles</option>
          {valuesOf(UserRole).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </Select>
        <Select
          name="status"
          className="w-40"
          value={filters.status}
          onChange={(event) => {
            setPage(1);
            setFilters({ ...filters, status: event.target.value });
          }}
        >
          <option value="">All statuses</option>
          {valuesOf(UserStatus).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </Card>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <Card className="overflow-hidden">
        {data === null ? (
          <Loading label="Loading users" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="hidden px-5 py-3 font-medium md:table-cell">Joined</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.length === 0 ? (
                    <EmptyRow colSpan={5}>No users match these filters.</EmptyRow>
                  ) : (
                    data.items.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar user={user} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{user.name}</p>
                              <p className="truncate text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={user.role === UserRole.User ? 'slate' : 'blue'}>
                            {ROLE_LABEL[user.role]}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={STATUS_TONE[user.status]}>{user.status}</Badge>
                        </td>
                        <td className="hidden px-5 py-3 text-slate-500 md:table-cell">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditing(user)}>
                              Edit
                            </Button>
                            {user.status === UserStatus.Active ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={user.id === admin?.id || busy}
                                onClick={() => patch(user, { status: UserStatus.Suspended })}
                              >
                                Suspend
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => patch(user, { status: UserStatus.Active })}
                              >
                                Restore
                              </Button>
                            )}
                            {/* Deleting is destructive, so only a super admin sees it. */}
                            {isSuperAdmin && user.id !== admin?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
                                disabled={busy}
                                onClick={() => removeUser(user)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
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

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add user"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button form="create-user" type="submit" loading={busy}>
              Create
            </Button>
          </>
        }
      >
        <form id="create-user" className="space-y-4" onSubmit={createUser}>
          <Input
            label="Full name"
            name="name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
          <Input
            label="Temporary password"
            name="password"
            type="text"
            hint="At least 8 characters, with a letter and a number."
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
          <Select
            label="Role"
            name="role"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
          >
            {valuesOf(UserRole).map((role) => (
              <option key={role} value={role} disabled={role !== UserRole.User && !isSuperAdmin}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </Select>
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit user"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={() => patch(editing, { name: editing.name, role: editing.role })}
            >
              Save
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Input
              label="Full name"
              name="editName"
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
            />
            <Select
              label="Role"
              name="editRole"
              value={editing.role}
              disabled={!isSuperAdmin}
              onChange={(event) => setEditing({ ...editing, role: event.target.value })}
            >
              {valuesOf(UserRole).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </Select>
            {!isSuperAdmin && (
              <p className="text-xs text-slate-500">
                Only a super admin can change roles or edit another administrator.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
