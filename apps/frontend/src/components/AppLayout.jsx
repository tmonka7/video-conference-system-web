import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Avatar, Button } from '@/components/ui';
import {
  BellIcon,
  CalendarIcon,
  ChatIcon,
  FileIcon,
  HomeIcon,
  InfoIcon,
  LogoutIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  VideoIcon,
} from '@/components/icons';

const NAV = [
  { to: '/app', label: 'Home', icon: HomeIcon, end: true },
  { to: '/app/meetings', label: 'Meetings', icon: CalendarIcon },
  { to: '/app/contacts', label: 'Contacts', icon: UsersIcon },
  { to: '/app/chat', label: 'Chat', icon: ChatIcon },
  { to: '/app/files', label: 'Files', icon: FileIcon },
  { to: '/app/settings', label: 'Settings', icon: SettingsIcon },
];

function NavItems({ onNavigate }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition',
              isActive
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-white/5 hover:text-white',
            ].join(' ')
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-6 py-6">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
        <VideoIcon className="h-5 w-5" />
      </span>
      <span className="text-base font-bold text-white">Conferencing</span>
    </div>
  );
}

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The drawer must not survive a route change on mobile.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin', { replace: true });
  };

  return (
    <div className="flex h-full bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-900 lg:flex">
        <Brand />
        <NavItems />
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            <LogoutIcon className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex h-full w-72 flex-col bg-navy-900 shadow-2xl">
            <Brand />
            <NavItems onNavigate={() => setDrawerOpen(false)} />
            <div className="space-y-1 border-t border-white/10 p-3">
              <NavLink
                to="/app/about"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
              >
                <InfoIcon className="h-5 w-5" />
                Help &amp; Support
              </NavLink>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
              >
                <LogoutIcon className="h-5 w-5" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 bg-white px-4 py-3 shadow-sm sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>

          <form
            className="relative hidden flex-1 sm:block"
            onSubmit={(event) => {
              event.preventDefault();
              const query = new FormData(event.currentTarget).get('q');
              if (query) navigate(`/app/meetings?search=${encodeURIComponent(query)}`);
            }}
          >
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              type="search"
              placeholder="Search meetings"
              className="w-full max-w-md rounded-xl bg-slate-100 py-2.5 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" aria-label="Notifications">
              <BellIcon />
            </Button>
            <NavLink to="/app/settings" aria-label="Your profile">
              <Avatar user={user} size="sm" />
            </NavLink>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
