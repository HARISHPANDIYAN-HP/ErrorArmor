import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, CircleDashed, RotateCcw, XCircle } from 'lucide-react';
import { api, errMsg, fmtDuration, unwrap } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { PageHeader, Skeleton, Spinner } from '../components/ui.jsx';

export default function ScanProgress() {
  const { scanId } = useParams();
  const nav = useNavigate();
  const { toast } = useApp();
  const [s, setS] = useState(null), [now, setNow] = useState(Date.now()), [err, setErr] = useState('');
  const timer = useRef();

  const poll = useCallback(async () => {
    try {
      const st = unwrap(await api.get(`/scans/${scanId}/status`));
      setS(st); setErr('');
      if (st.status === 'completed') return nav(`/app/scans/${scanId}`, { replace: true });
      if (['queued', 'running'].includes(st.status)) timer.current = setTimeout(poll, 1000);
    } catch (e) { setErr(errMsg(e)); timer.current = setTimeout(poll, 3000); }
  }, [scanId, nav]);

  useEffect(() => { poll(); return () => clearTimeout(timer.current); }, [poll]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  const act = async (path, msg) => { try { await api.post(`/scans/${scanId}/${path}`); toast(msg, 'success'); poll(); } catch (e) { toast(errMsg(e), 'error'); } };
  if (!s) return err ? <p role="alert" className="text-red-500">{err}</p> : <Skeleton className="h-64" />;

  const active = ['queued', 'running'].includes(s.status);
  const elapsed = s.startedAt ? (active ? now - new Date(s.startedAt) : s.elapsedMs) : 0;
  const pct = s.status === 'completed' ? 100 : Math.round((s.stageIndex / s.stages.length) * 100);

  return (
    <>
      <PageHeader title="Scan in progress" sub={`Scan ${scanId.slice(-6)} · progress is read from the server every second.`}>
        {active && <button className="btn-ghost" onClick={() => window.confirm('Cancel this scan?') && act('cancel', 'Scan cancelled')}>Cancel scan</button>}
      </PageHeader>
      {err && <p role="alert" className="mb-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-500">Connection problem: {err}. Retrying…</p>}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between text-sm"><span className="font-medium">{s.status === 'queued' ? 'Waiting in queue…' : s.status === 'running' ? s.stages[Math.min(s.stageIndex, s.stages.length - 1)] : s.status}</span><span className="tabular-nums">{pct}%</span></div>
          <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-ink-600" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className={`h-full rounded-full transition-all duration-500 ${s.status === 'failed' ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} /></div>
          <ol className="space-y-3">
            {s.stages.map((name, i) => {
              const done = s.status === 'completed' || i < s.stageIndex, cur = active && i === s.stageIndex && s.status === 'running';
              return (<li key={name} className="flex items-center gap-3 text-sm">
                <span className={`grid h-6 w-6 place-items-center rounded-full ${done ? 'bg-emerald-500/15 text-emerald-500' : cur ? 'bg-brand-500/15 text-brand-500' : 'bg-slate-100 text-slate-400 dark:bg-ink-700'}`}>{done ? <Check size={14} /> : cur ? <Spinner size={14} /> : <CircleDashed size={14} />}</span>
                <span className={done || cur ? '' : 'muted'}>{name}</span></li>);
            })}
          </ol>
        </section>
        <aside className="space-y-4">
          <div className="card grid grid-cols-2 gap-4 p-5 text-sm">
            {[['Files found', s.filesDiscovered], ['Files processed', s.filesAnalyzed], ['Findings so far', s.findingsCount], ['Elapsed', fmtDuration(elapsed)]].map(([k, v]) => (<div key={k}><p className="muted">{k}</p><p className="text-xl font-semibold tabular-nums">{v}</p></div>))}
          </div>
          {s.status === 'failed' && (<div className="card border-red-500/40 p-5" role="alert"><p className="flex items-center gap-2 font-semibold text-red-500"><XCircle size={18} />Scan failed</p><p className="mt-1 text-sm">{s.errorMessage}</p><button className="btn-primary mt-3" onClick={() => act('retry', 'Scan restarted')}><RotateCcw size={16} />Retry</button></div>)}
          {s.status === 'cancelled' && (<div className="card p-5"><p className="font-semibold">Scan cancelled</p><div className="mt-3 flex gap-2"><button className="btn-primary" onClick={() => act('retry', 'Scan restarted')}>Restart</button><Link className="btn-ghost" to="/app/scans">History</Link></div></div>)}
        </aside>
      </div>
    </>
  );
}
