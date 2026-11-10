import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, FileText, Sparkles } from 'lucide-react';
import { api, download, errMsg, fmtDate, fmtDuration, unwrap } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import FindingsTable from '../components/FindingsTable.jsx';
import FindingInspector from '../components/FindingInspector.jsx';
import { CAT_LABEL, CheckIcon, Empty, PageHeader, SEVERITY_COLOR, Skeleton, StatCard, StatusBadge } from '../components/ui.jsx';

const TABS = [
  ['overview', 'Overview'], ['all', 'All findings'], ['api', 'API analysis', 'api'], ['logic', 'Logic & code quality', 'logic'],
  ['security', 'Security', 'security'], ['dependency', 'Dependencies', 'dependencies'], ['tests', 'Test results', 'tests'], ['structure', 'Project structure'],
];
const PALETTE = ['#3b82f6', '#22d3ee', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#94a3b8', '#ec4899'];

export default function ScanResults() {
  const { scanId } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { toast } = useApp();
  const [scan, setScan] = useState(null), [report, setReport] = useState(null), [tab, setTab] = useState('overview'), [open, setOpen] = useState(params.get('finding')), [tick, setTick] = useState(0);

  useEffect(() => {
    api.get(`/scans/${scanId}`).then(async (r) => {
      const s = unwrap(r).scan; setScan(s);
      if (s.status === 'completed') api.get(`/scans/${scanId}/report`).then((x) => setReport(unwrap(x).report)).catch(() => {});
    }).catch((e) => { toast(errMsg(e), 'error'); nav('/app/scans'); });
  }, [scanId, nav, toast]);

  const close = useCallback(() => { setOpen(null); if (params.get('finding')) setParams({}, { replace: true }); }, [params, setParams]);
  if (!scan) return <div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-40" /></div>;
  if (scan.status !== 'completed') return <Navigate to={`/app/scans/${scanId}/progress`} replace />;

  const checked = scan.options?.categories || [];
  const sev = ['critical', 'high', 'medium', 'low', 'info'].map((k) => ({ name: k, count: scan.summary?.bySeverity?.[k] || 0 }));
  const cats = Object.entries(scan.summary?.byCategory || {}).map(([k, v]) => ({ name: CAT_LABEL[k] || k, value: v }));
  const cnt = (st) => scan.checks.filter((c) => c.status === st).length;
  const exp = (format) => download(`/scans/${scanId}/report/export?format=${format}`, `errorarmor-report.${format}`).catch((e) => toast(errMsg(e), 'error'));
  const notChecked = (opt) => !checked.includes(opt);

  const body = {
    overview: (
      <div className="space-y-6">
        {report?.narrative && <div className="rounded-2xl border border-ai-500/30 bg-ai-500/5 p-4 text-sm"><p className="mb-1 flex items-center gap-1.5 font-semibold text-ai-400"><Sparkles size={14} />Scan summary <span className="text-xs font-normal muted">(rule-based, no external AI)</span></p>{report.narrative}</div>}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Files analyzed" value={scan.filesAnalyzed} /><StatCard label="Findings" value={scan.findingsCount} />
          <StatCard label="Checks passed" value={cnt('passed')} tone="text-emerald-500" /><StatCard label="Checks failed / skipped" value={`${cnt('failed')} / ${cnt('skipped')}`} tone="text-amber-500" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4"><h3 className="mb-2 font-semibold">By severity</h3><ResponsiveContainer width="100%" height={200}><BarChart data={sev}><CartesianGrid strokeDasharray="3 3" stroke="#33466b55" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} width={28} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="count" radius={[6, 6, 0, 0]}>{sev.map((s) => <Cell key={s.name} fill={SEVERITY_COLOR[s.name]} />)}</Bar></BarChart></ResponsiveContainer></div>
          <div className="card p-4"><h3 className="mb-2 font-semibold">By category</h3>{cats.length ? <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={cats} dataKey="value" nameKey="name" innerRadius={40} outerRadius={75}>{cats.map((c, i) => <Cell key={c.name} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer> : <p className="py-16 text-center text-sm muted">No findings.</p>}</div>
        </div>
        <div className="card"><h3 className="p-4 font-semibold">Checks performed</h3>
          <ul className="divide-y divide-slate-200 dark:divide-ink-600/60">{scan.checks.map((c) => (<li key={c.id} className="flex items-center gap-3 px-4 py-2 text-sm"><CheckIcon status={c.status} /><span className="flex-1">{c.name}{c.note && <span className="block text-xs muted">{c.note}</span>}</span><span className="text-xs capitalize muted">{c.status}</span></li>))}</ul></div>
        <p className="text-xs muted">Static analysis cannot find every error. Items marked &ldquo;heuristic&rdquo; are suspicions - confirm them with a test before changing code.</p>
      </div>
    ),
    all: <FindingsTable scanId={scanId} onOpen={setOpen} refreshKey={tick} />,
    structure: (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4"><h3 className="mb-3 font-semibold">Detected technologies</h3><div className="flex flex-wrap gap-2">{[...(scan.technologies?.languages || []), ...(scan.technologies?.frameworks || [])].map((t) => <span key={t} className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">{t}</span>)}</div>
          <h3 className="mb-2 mt-5 font-semibold">Files by type</h3>{Object.entries(scan.structure?.byExtension || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} className="flex justify-between border-b border-slate-100 py-1 text-sm dark:border-ink-700"><span className="font-mono">{k}</span><span className="tabular-nums">{v}</span></div>)}</div>
        <div className="card p-4"><h3 className="mb-3 font-semibold">Top-level folders</h3>{(scan.structure?.topDirs || []).map((d) => <div key={d.name} className="mb-2"><div className="flex justify-between text-sm"><span className="font-mono">{d.name}</span><span className="tabular-nums">{d.count}</span></div><div className="h-1.5 rounded-full bg-slate-200 dark:bg-ink-600"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(d.count / scan.structure.totalFiles) * 100}%` }} /></div></div>)}</div>
      </div>
    ),
    tests: (
      <div className="card"><h3 className="p-4 font-semibold">Test results</h3>
        {(scan.checks.filter((c) => c.category === 'test')).length === 0 || notChecked('tests')
          ? <Empty icon={FileText} title="Tests were not run">Test execution needs an isolated sandbox and was not part of this scan. No test results are shown rather than inventing any.</Empty>
          : scan.checks.filter((c) => c.category === 'test').map((c) => <div key={c.id} className="flex items-start gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-ink-600/60"><CheckIcon status={c.status} /><span>{c.name}<span className="block text-xs muted">{c.note}</span></span></div>)}
      </div>
    ),
  };

  return (
    <>
      <PageHeader title={scan.project?.name || 'Scan results'} sub={`Scan ${scanId.slice(-8)} · ${fmtDate(scan.completedAt)} · took ${fmtDuration(scan.durationMs)}`}>
        <StatusBadge value={scan.status} />
        <button className="btn-ghost" onClick={() => exp('json')}><Download size={14} />JSON</button>
        <button className="btn-ghost" onClick={() => exp('html')}><Download size={14} />HTML</button>
        <Link to="/app/new" className="btn-primary">New scan</Link>
      </PageHeader>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-ink-600/60" role="tablist">
        {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? 'border-brand-500 text-brand-500' : 'border-transparent muted hover:text-slate-900 dark:hover:text-white'}`}>{label}</button>)}
      </div>
      {(() => {
        const t = TABS.find((x) => x[0] === tab);
        if (['api', 'logic', 'security', 'dependency'].includes(tab)) {
          if (notChecked(t[2])) return <div className="card"><Empty title={`${t[1]} was not checked`}>This category was not selected for this scan. Start a new scan with it enabled.</Empty></div>;
          return <FindingsTable scanId={scanId} group={tab} onOpen={setOpen} refreshKey={tick} />;
        }
        return body[tab];
      })()}
      {open && <FindingInspector id={open} onClose={close} onChanged={() => setTick((t) => t + 1)} />}
    </>
  );
}
