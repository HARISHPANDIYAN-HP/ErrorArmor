import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, unwrap } from '../lib/api.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme !== 'light');
  try { localStorage.setItem('ea_theme', theme); } catch { /* storage unavailable */ }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  useEffect(() => {
    api.get('/auth/me').then((r) => { const u = unwrap(r).user; setUser(u); applyTheme(u.preferences?.theme || 'dark'); })
      .catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({
    user, loading, toast, setUser,
    async login(email, password) { const u = unwrap(await api.post('/auth/login', { email, password })).user; setUser(u); applyTheme(u.preferences?.theme || 'dark'); },
    async register(name, email, password) { const u = unwrap(await api.post('/auth/register', { name, email, password })).user; setUser(u); },
    async logout() { await api.post('/auth/logout').catch(() => {}); setUser(null); },
  }), [user, loading, toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`pointer-events-auto animate-rise rounded-xl border px-4 py-3 text-sm shadow-lg ${
            t.type === 'error' ? 'border-red-500/40 bg-red-950 text-red-100' : t.type === 'success' ? 'border-emerald-500/40 bg-emerald-950 text-emerald-100' : 'border-ink-500 bg-ink-800 text-slate-100'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
