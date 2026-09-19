import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Avatar, Badge, Button } from '@/components/ui';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/users', label: 'Users' },
  { to: '/meetings', label: 'Meetings' },
  { to: '/audit', label: 'Audit log' },
];

export default function AdminLayout() {
  const { admin, signOut, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-full bg-slate-100">
      <aside className="hidden w-60 shrink-0 flex-col bg-navy-900 lg:flex">
        <div className="px-6 py-6">
          <p className="text-base font-bold text-white">Admin Panel</p>
          <p className="text-xs text-slate-400">Video Conferencing System</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'rounded-xl px-4 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar user={admin} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{admin?.name}</p>
              <p className="truncate text-xs text-slate-400">{admin?.email}</p>
            </div>
          </div>
          {isSuperAdmin && (
            <p className="mt-2">
              <Badge tone="blue">Super admin</Badge>
            </p>
          )}
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The sidebar collapses on small screens, so the nav moves up here. */}
        <nav className="flex gap-1 overflow-x-auto bg-navy-900 px-3 py-2 lg:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium',
                  isActive ? 'bg-brand-600 text-white' : 'text-slate-300',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={handleSignOut}
            className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300"
          >
            Sign out
          </button>
        </nav>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
