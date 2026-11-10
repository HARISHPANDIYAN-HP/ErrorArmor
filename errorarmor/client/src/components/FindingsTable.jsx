import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api, errMsg, unwrap } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { CAT_LABEL, ConfidenceBar, Empty, Pager, SeverityBadge, Skeleton, VerificationBadge } from './ui.jsx';

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

export default function FindingsTable({ scanId, group = 'all', onOpen, refreshKey }) {
  const { toast } = useApp();
  const [f, setF] = useState({ q: '', severity: '', category: '', verification: '', review: '', sort: 'severity', page: 1 });
  const [data, setData] = useState(null), [q, setQ] = useState('');
  const set = (patch) => setF((x) => ({ ...x, page: 1, ...patch }));

  useEffect(() => { const t = setTimeout(() => set({ q }), 300); return () => clearTimeout(t); }, [q]); // debounce search

  const load = useCallback(async () => {
    const params = Object.fromEntries(Object.entries({ ...f, group }).filter(([, v]) => v !== ''));
    try { const r = await api.get(`/scans/${scanId}/findings`, { params }); setData({ items: unwrap(r).findings, meta: r.data.meta }); } catch (e) { toast(errMsg(e), 'error'); }
  }, [f, group, scanId, toast]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const sel = 'input !w-auto !py-1.5';
  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 dark:border-ink-600/60">
        <div className="relative min-w-[180px] flex-1"><Search size={14} className="absolute left-3 top-3 muted" /><input className="input !pl-8" placeholder="Search title or file…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search findings" /></div>
        <select className={sel} value={f.severity} onChange={(e) => set({ severity: e.target.value })} aria-label="Severity"><option value="">All severities</option>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className={sel} value={f.verification} onChange={(e) => set({ verification: e.target.value })} aria-label="Verification"><option value="">Any verification</option><option value="static-analysis">Static analysis</option><option value="heuristic">Heuristic</option><option value="confirmed-by-test">Confirmed by test</option><option value="resolved">Resolved</option></select>
        <select className={sel} value={f.review} onChange={(e) => set({ review: e.target.value })} aria-label="Review status"><option value="">Any review state</option><option value="open">Open</option><option value="reviewed">Reviewed</option><option value="false-positive">False positive</option><option value="resolved">Resolved</option></select>
        <select className={sel} value={f.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort by"><option value="severity">Sort: severity</option><option value="file">Sort: file</option><option value="category">Sort: category</option><option value="confidence">Sort: confidence</option></select>
      </div>
      {!data ? <div className="space-y-2 p-4"><Skeleton /><Skeleton /><Skeleton /></div> : data.items.length === 0 ? <Empty title="No findings match">Adjust the filters, or this check found nothing - which is good news.</Empty> : (
        <ul className="divide-y divide-slate-200 dark:divide-ink-600/60">
          {data.items.map((x) => (
            <li key={x._id}><button className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-ink-700/50" onClick={() => onOpen(x._id)}>
              <SeverityBadge value={x.severity} />
              <span className="min-w-0 flex-1"><span className={`block truncate text-sm font-medium ${x.reviewStatus === 'false-positive' ? 'line-through opacity-60' : ''}`}>{x.title}</span>
                <span className="block truncate font-mono text-xs muted">{x.filePath || '-'}{x.line ? `:${x.line}` : ''}</span></span>
              <span className="hidden text-xs muted sm:block">{CAT_LABEL[x.category] || x.category}</span>
              <span className="hidden md:block"><VerificationBadge value={x.verificationStatus} /></span>
              <ConfidenceBar value={x.confidence} />
            </button></li>))}
        </ul>)}
      <Pager meta={data?.meta} onPage={(page) => setF((x) => ({ ...x, page }))} />
    </div>
  );
}
