import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GitCompare, History as HistoryIcon, Trash2 } from 'lucide-react';
import { api, errMsg, fmtDate, fmtDuration, unwrap } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Empty, PageHeader, Pager, SeverityBadge, Skeleton, StatusBadge } from '../components/ui.jsx';

export default function History() {
  const { toast } = useApp();
  const nav = useNavigate();
  const [f, setF] = useState({ q: '', status: '', from: '', to: '', page: 1 }), [q, setQ] = useState('');
  const [data, setData] = useState(null), [picked, setPicked] = useState([]);
  useEffect(() => { const t = setTimeout(() => setF((x) => ({ ...x, q, page: 1 })), 300); return () => clearTimeout(t); }, [q]);

  const load = useCallback(async () => {
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
    if (params.to) params.to = new Date(`${params.to}T23:59:59`).toISOString();
    if (params.from) params.from = new Date(`${params.from}T00:00:00`).toISOString();
    try { const r = await api.get('/scans', { params }); setData({ items: unwrap(r).scans, meta: r.data.meta }); } catch (e) { toast(errMsg(e), 'error'); }
  }, [f, toast]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));
  const del = async (s) => {
    if (!window.confirm('Delete this scan and its findings? This cannot be undone.')) return;
    try { await api.delete(`/scans/${s._id}`); toast('Scan deleted', 'success'); load(); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const delProject = async (s) => {
    if (!s.project?._id || !window.confirm(`Delete project "${s.project.name}", all its scans and the uploaded files?`)) return;
    try { await api.delete(`/projects/${s.project._id}`); toast('Project and uploaded files deleted', 'success'); load(); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const set = (p) => setF((x) => ({ ...x, page: 1, ...p }));

  return (
    <>
      <PageHeader title="Scan history" sub="Open, compare or delete previous scans.">
        <button className="btn-primary" disabled={picked.length !== 2} onClick={() => nav(`/app/compare?base=${picked[0]}&head=${picked[1]}`)}><GitCompare size={16} />Compare selected ({picked.length}/2)</button>
      </PageHeader>
      <div className="card">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3 dark:border-ink-600/60">
          <input className="input !w-56" placeholder="Search by project name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search by project" />
          <select className="input !w-auto" value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status"><option value="">All statuses</option>{['completed', 'running', 'queued', 'failed', 'cancelled'].map((s) => <option key={s}>{s}</option>)}</select>
          <label className="flex items-center gap-1 text-xs muted">From<input type="date" className="input !w-auto" value={f.from} onChange={(e) => set({ from: e.target.value })} /></label>
          <label className="flex items-center gap-1 text-xs muted">To<input type="date" className="input !w-auto" value={f.to} onChange={(e) => set({ to: e.target.value })} /></label>
        </div>
        {!data ? <div className="space-y-2 p-4"><Skeleton /><Skeleton /><Skeleton /></div> : data.items.length === 0 ? <Empty icon={HistoryIcon} title="No scans found" action={<Link to="/app/new" className="btn-primary mt-2">Start a scan</Link>}>Scans you run will appear here.</Empty> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="text-xs uppercase muted"><tr><th className="p-3"><span className="sr-only">Select</span></th><th className="p-3">Project</th><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3">Findings</th><th className="p-3">Duration</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y divide-slate-200 dark:divide-ink-600/60">{data.items.map((s) => (
              <tr key={s._id} className="hover:bg-slate-50 dark:hover:bg-ink-700/40">
                <td className="p-3"><input type="checkbox" className="accent-brand-500" disabled={s.status !== 'completed'} checked={picked.includes(s._id)} onChange={() => toggle(s._id)} aria-label="Select for comparison" /></td>
                <td className="p-3 font-medium"><Link className="hover:text-brand-500" to={s.status === 'completed' ? `/app/scans/${s._id}` : `/app/scans/${s._id}/progress`}>{s.project?.name || 'Deleted project'}</Link></td>
                <td className="p-3 muted">{fmtDate(s.createdAt)}</td><td className="p-3"><StatusBadge value={s.status} /></td>
                <td className="p-3 tabular-nums">{s.findingsCount}</td><td className="p-3 muted">{fmtDuration(s.durationMs)}</td>
                <td className="p-3 text-right"><button className="btn-ghost !px-2 !py-1" onClick={() => del(s)} aria-label="Delete scan" title="Delete scan"><Trash2 size={14} /></button>
                  {s.project?._id && <button className="btn-ghost ml-1 !px-2 !py-1 text-xs" onClick={() => delProject(s)} title="Delete project and uploaded files">Delete project</button>}</td>
              </tr>))}</tbody></table></div>)}
        <Pager meta={data?.meta} onPage={(page) => setF((x) => ({ ...x, page }))} />
      </div>
    </>
  );
}

export function Compare() {
  const [sp] = useSearchParams();
  const { toast } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/scans/compare', { params: { base: sp.get('base'), head: sp.get('head') } }).then((r) => setD(unwrap(r))).catch((e) => toast(errMsg(e), 'error')); }, [sp, toast]);
  if (!d) return <Skeleton className="h-64" />;
  const List = ({ title, items, tone }) => (
    <section className="card"><h2 className={`p-4 font-semibold ${tone}`}>{title} ({items.length})</h2>
      {items.length === 0 ? <p className="p-6 text-center text-sm muted">None</p> : <ul className="divide-y divide-slate-200 dark:divide-ink-600/60">{items.map((f) => (<li key={f._id} className="flex items-center gap-3 px-4 py-2"><SeverityBadge value={f.severity} /><span className="min-w-0 flex-1"><span className="block truncate text-sm">{f.title}</span><span className="block truncate font-mono text-xs muted">{f.filePath}</span></span></li>))}</ul>}
    </section>
  );
  return (
    <>
      <PageHeader title="Compare scans" sub={`${d.base.project?.name} · ${fmtDate(d.base.createdAt)} → ${fmtDate(d.head.createdAt)} (${d.unchanged} unchanged)`}>
        <Link className="btn-ghost" to="/app/scans">Back</Link></PageHeader>
      <p className="mb-4 text-xs muted">&ldquo;Base&rdquo; is the first scan you selected and &ldquo;head&rdquo; the second. New = in head only; resolved = in base only. Matching uses rule + file + a stable key, so moving code lines does not create false differences.</p>
      <div className="grid gap-4 lg:grid-cols-2"><List title="Newly introduced" items={d.introduced} tone="text-red-500" /><List title="Resolved" items={d.resolved} tone="text-emerald-500" /></div>
    </>
  );
}
