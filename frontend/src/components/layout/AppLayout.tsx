/**
 * components/layout/AppLayout.tsx
 * Persistent shell with sidebar nav and top bar — matches the prototype exactly.
 * Owner: Meya / Dennise
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import clsx from 'clsx';

// Simple inline SVG icons to avoid a heavy icon dependency
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const BellIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const counselorNav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <HomeIcon /> },
    { to: '/intake/new', label: 'New Intake', icon: <ClipboardIcon /> },
    { to: '/dashboard', label: 'Settings', icon: <SettingsIcon /> },
  ];

  const adminNav: NavItem[] = [
    { to: '/admin', label: 'Dashboard', icon: <HomeIcon /> },
    { to: '/admin/patients', label: 'Patients', icon: <ClipboardIcon /> },
    { to: '/admin/forms', label: 'Forms', icon: <ClipboardIcon /> },
    { to: '/admin/settings', label: 'Settings', icon: <SettingsIcon /> },
  ];

  const navItems = isAdmin ? adminNav : counselorNav;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {/* CareLink logo mark — simplified SVG matching the prototype's circular people icon */}
            <svg viewBox="0 0 40 40" className="w-9 h-9 flex-shrink-0">
              <circle cx="20" cy="20" r="19" fill="#eef2ff" />
              <circle cx="20" cy="12" r="4" fill="#e63946" />
              <circle cx="28" cy="22" r="4" fill="#3b4fe4" />
              <circle cx="12" cy="22" r="4" fill="#3b4fe4" />
              <circle cx="20" cy="30" r="4" fill="#e63946" />
            </svg>
            <div>
              <span className="font-bold text-sm text-primary-700">Care</span>
              <span className="font-bold text-sm text-accent-red">Link</span>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/admin'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary border-l-4 border-primary pl-2'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex-1" />

          {/* Search */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2 w-64">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search for something"
              className="bg-transparent text-sm text-gray-500 placeholder:text-gray-400 outline-none w-full"
            />
          </div>

          {/* Icons */}
          <div className="flex items-center gap-4 ml-4">
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <SettingsIcon />
            </button>
            <button className="text-gray-400 hover:text-gray-600 transition-colors relative">
              <BellIcon />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent-red rounded-full" />
            </button>
            {/* User avatar */}
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary font-semibold text-sm">
              {user?.username[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
