import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errMsg, unwrap } from '../lib/api.js';
import { applyTheme, useApp } from '../context/AppContext.jsx';
import { PageHeader, Spinner } from '../components/ui.jsx';

const CATS = [['syntax', 'Syntax'], ['logic', 'Logic'], ['api', 'API'], ['configuration', 'Configuration'], ['dependencies', 'Dependencies'], ['security', 'Security']];
const LANGS = [['javascript', 'JavaScript / JSX'], ['json', 'JSON'], ['python', 'Python']];

export default function SettingsPage() {
  const { user, setUser, toast } = useApp();
  const nav = useNavigate();
  const p = user.preferences;
  const [name, setName] = useState(user.name), [theme, setTheme] = useState(p.theme), [cats, setCats] = useState(p.defaultCategories.filter((c) => c !== 'tests'));
  const [langs, setLangs] = useState(p.languages), [ai, setAi] = useState(p.aiEnabled), [days, setDays] = useState(p.retentionDays);
  const [busy, setBusy] = useState(false), [pw, setPw] = useState(''), [confirmDel, setConfirmDel] = useState(false);
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const save = async (e) => {
    e.preventDefault();
    if (!cats.length) return toast('Choose at least one default scan category', 'error');
    setBusy(true);
    try {
      const u = unwrap(await api.patch('/users/me', { name, preferences: { theme, defaultCategories: cats, languages: langs, aiEnabled: ai, retentionDays: Number(days) } })).user;
      setUser(u); applyTheme(u.preferences.theme); toast('Settings saved', 'success');
    } catch (err) { toast(errMsg(err), 'error'); } finally { setBusy(false); }
  };
  const remove = async () => {
    try { await api.delete('/users/me', { data: { password: pw } }); setUser(null); nav('/'); } catch (err) { toast(errMsg(err), 'error'); }
  };
  const Check = ({ checked, onChange, children }) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-500" checked={checked} onChange={onChange} />{children}</label>;

  return (
    <>
      <PageHeader title="Settings" sub={user.email} />
      <form onSubmit={save} className="space-y-6">
        <section className="card space-y-4 p-5"><h2 className="font-semibold">Profile &amp; appearance</h2>
          <div><label className="label" htmlFor="n">Name</label><input id="n" className="input max-w-sm" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required /></div>
          <div><label className="label" htmlFor="t">Theme</label><select id="t" className="input max-w-[200px]" value={theme} onChange={(e) => { setTheme(e.target.value); applyTheme(e.target.value); }}><option value="dark">Dark</option><option value="light">Light</option></select></div></section>
        <section className="card space-y-3 p-5"><h2 className="font-semibold">Default scan settings</h2>
          <div className="grid gap-2 sm:grid-cols-3">{CATS.map(([id, l]) => <Check key={id} checked={cats.includes(id)} onChange={() => toggle(cats, setCats, id)}>{l}</Check>)}</div>
          <h3 className="pt-2 text-sm font-medium">Languages</h3><div className="flex flex-wrap gap-4">{LANGS.map(([id, l]) => <Check key={id} checked={langs.includes(id)} onChange={() => toggle(langs, setLangs, id)}>{l}</Check>)}</div>
          <p className="text-xs muted">TypeScript and other languages are listed in file inventories but not analysed yet.</p></section>
        <section className="card space-y-3 p-5"><h2 className="font-semibold">Privacy &amp; data</h2>
          <Check checked={ai} onChange={() => setAi(!ai)}>Allow optional AI analysis</Check>
          <p className="text-xs muted">No external AI provider is connected in this build, so this preference is stored for future use. Explanations are rule-based and your code is never sent to a third party.</p>
          <div><label className="label" htmlFor="d">Keep scan results for (days)</label><input id="d" type="number" min={1} max={365} className="input max-w-[140px]" value={days} onChange={(e) => setDays(e.target.value)} />
            <p className="mt-1 text-xs muted">Older scans, findings and their uploaded files are deleted automatically.</p></div></section>
        <button className="btn-primary" disabled={busy}>{busy && <Spinner />}Save settings</button>
      </form>
      <section className="card mt-8 border-red-500/30 p-5"><h2 className="font-semibold text-red-500">Danger zone</h2>
        <p className="mb-3 mt-1 text-sm muted">Deleting your account permanently removes your projects, uploaded files, scans and findings.</p>
        {!confirmDel ? <button className="btn-ghost text-red-500" onClick={() => setConfirmDel(true)}>Delete account…</button> : (
          <div className="flex flex-wrap items-end gap-2"><div><label className="label" htmlFor="pw">Confirm your password</label><input id="pw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></div>
            <button className="btn-danger" disabled={!pw} onClick={remove}>Permanently delete</button><button className="btn-ghost" onClick={() => setConfirmDel(false)}>Cancel</button></div>)}
      </section>
    </>
  );
}
