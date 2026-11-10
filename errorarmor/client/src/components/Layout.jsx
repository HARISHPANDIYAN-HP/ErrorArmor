import { useState } from 'react';
import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { History, LayoutDashboard, LogOut, Menu, Moon, PlusCircle, Settings, Sun, X } from 'lucide-react';
import { useApp, applyTheme } from '../context/AppContext.jsx';
import { api } from '../lib/api.js';
import { Logo, Spinner } from './ui.jsx';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/new', label: 'New scan', icon: PlusCircle },
  { to: '/app/scans', label: 'Scan history', icon: History },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { user, loading, logout, setUser, toast } = useApp();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  if (loading) return <div className="grid h-screen place-items-center"><Spinner size={28} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  const dark = document.documentElement.classList.contains('dark');

  const toggleTheme = async () => {
    const theme = dark ? 'light' : 'dark';
    applyTheme(theme);
    setUser({ ...user, preferences: { ...user.preferences, theme } });
    api.patch('/users/me', { preferences: { theme } }).catch(() => toast('Could not save theme preference', 'error'));
  };

  const link = ({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-brand-500/10 text-brand-500' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-700'}`;
  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-brand-500 focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white p-4 transition dark:border-ink-600/60 dark:bg-ink-800 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-6 flex items-center justify-between"><Logo /><button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button></div>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={link} onClick={() => setOpen(false)}><n.icon size={18} />{n.label}</NavLink>)}
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-4 py-3 backdrop-blur dark:border-ink-600/60 dark:bg-ink-900/70">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <span className="hidden text-sm muted lg:block">Scan Deep. Detect Errors. Fix with Confidence.</span>
          <div className="flex items-center gap-2">
            <button className="btn-ghost !px-2" onClick={toggleTheme} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <span className="hidden text-sm sm:block">{user.name}</span>
            <button className="btn-ghost" onClick={async () => { await logout(); nav('/'); }}><LogOut size={16} />Log out</button>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
