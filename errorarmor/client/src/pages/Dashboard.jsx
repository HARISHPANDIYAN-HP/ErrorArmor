import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertOctagon, AlertTriangle, CheckCircle2, FileCode2, PlusCircle, ScanSearch, Upload, History as HistoryIcon, Wand2 } from 'lucide-react';
import { api, errMsg, fmtDate, unwrap } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { CAT_LABEL, Empty, PageHeader, SEVERITY_COLOR, SeverityBadge, Skeleton, StatCard, StatusBadge } from '../components/ui.jsx';

const PALETTE = ['#3b82f6', '#22d3ee', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#94a3b8', '#ec4899'];

export default function Dashboard() {
  const { user, toast } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/dashboard').then((r) => setD(unwrap(r))).catch((e) => toast(errMsg(e), 'error')); }, [toast]);

  const sev = d ? ['critical', 'high', 'medium', 'low', 'info'].map((k) => ({ name: k, count: d.bySeverity[k] || 0 })) : [];
  const cats = d ? Object.entries(d.byCategory).map(([k, v]) => ({ name: CAT_LABEL[k] || k, value: v })) : [];
  const tip = { contentStyle: { background: '#101a2e', border: '1px solid #243453', borderRadius: 12, color: '#e2e8f0' } };

  return (
    <>
      <PageHeader title={`Welcome back, ${user.name.split(' ')[0]}`} sub="Here is what your scans have found so far.">
        <Link to="/app/new" className="btn-primary"><PlusCircle size={16} />New scan</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total scans" value={d?.totals.scans} icon={ScanSearch} />
        <StatCard label="Files analyzed" value={d?.totals.filesAnalyzed} icon={FileCode2} />
        <StatCard label="Errors (high + critical)" value={d?.totals.errors} icon={AlertOctagon} tone="text-red-500" />
        <StatCard label="Warnings" value={d?.totals.warnings} icon={AlertTriangle} tone="text-amber-500" />
        <StatCard label="Passed checks" value={d?.totals.passedChecks} icon={CheckCircle2} tone="text-emerald-500" />
      </div>

      {d && d.totals.scans === 0 ? (
        <div className="card mt-6">
          <Empty icon={Upload} title="Run your first scan" action={<Link to="/app/new" className="btn-primary mt-2">Start new scan</Link>}>
            Zip your project (or choose a folder), tick the checks you want, and ErrorArmor will report syntax, API, logic, configuration, dependency and security findings with plain-language fixes.
          </Empty>
          <ol className="grid gap-3 border-t border-slate-200 p-4 text-sm dark:border-ink-600/60 sm:grid-cols-3">
            {['Upload a ZIP or pick a folder', 'Watch real scan progress', 'Open any finding for the root cause and a fix'].map((t, i) => (
              <li key={t} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-500">{i + 1}</span>{t}</li>
            ))}
          </ol>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <section className="card p-4" aria-label="Severity distribution"><h2 className="mb-3 font-semibold">Severity distribution</h2>
              {!d ? <Skeleton className="h-52" /> : (
                <ResponsiveContainer width="100%" height={210}><BarChart data={sev}><CartesianGrid strokeDasharray="3 3" stroke="#33466b55" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} width={30} tick={{ fontSize: 12 }} /><Tooltip {...tip} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>{sev.map((s) => <Cell key={s.name} fill={SEVERITY_COLOR[s.name]} />)}</Bar></BarChart></ResponsiveContainer>)}
            </section>
            <section className="card p-4" aria-label="Category distribution"><h2 className="mb-3 font-semibold">Error categories</h2>
              {!d ? <Skeleton className="h-52" /> : cats.length === 0 ? <p className="py-16 text-center text-sm muted">No open findings.</p> : (
                <ResponsiveContainer width="100%" height={210}><PieChart><Pie data={cats} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>{cats.map((c, i) => <Cell key={c.name} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer>)}
            </section>
            <section className="card p-4" aria-label="Scan activity"><h2 className="mb-3 font-semibold">Activity (14 days)</h2>
              {!d ? <Skeleton className="h-52" /> : d.timeline.length === 0 ? <p className="py-16 text-center text-sm muted">No recent scans.</p> : (
                <ResponsiveContainer width="100%" height={210}><AreaChart data={d.timeline}><CartesianGrid strokeDasharray="3 3" stroke="#33466b55" /><XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} /><YAxis allowDecimals={false} width={30} tick={{ fontSize: 12 }} /><Tooltip {...tip} />
                  <Area type="monotone" dataKey="findings" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Findings" /><Area type="monotone" dataKey="scans" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} name="Scans" /></AreaChart></ResponsiveContainer>)}
            </section>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="card"><div className="flex items-center justify-between p-4"><h2 className="font-semibold">Recent scans</h2><Link to="/app/scans" className="text-sm text-brand-500 hover:underline">View all</Link></div>
              {!d ? <div className="space-y-2 p-4"><Skeleton /><Skeleton /></div> : d.recentScans.length === 0 ? <p className="p-6 text-center text-sm muted">No scans yet.</p> : (
                <ul className="divide-y divide-slate-200 dark:divide-ink-600/60">{d.recentScans.map((s) => (
                  <li key={s._id}><Link className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-ink-700/50" to={`/app/scans/${s._id}`}>
                    <div className="min-w-0"><p className="truncate font-medium">{s.project?.name || 'Deleted project'}</p><p className="text-xs muted">{fmtDate(s.createdAt)} · {s.findingsCount} findings</p></div><StatusBadge value={s.status} /></Link></li>))}</ul>)}
            </section>
            <section className="card"><h2 className="p-4 font-semibold">Latest findings</h2>
              {!d ? <div className="space-y-2 p-4"><Skeleton /><Skeleton /></div> : d.latestFindings.length === 0 ? <p className="p-6 text-center text-sm muted">No open findings. 🎉</p> : (
                <ul className="divide-y divide-slate-200 dark:divide-ink-600/60">{d.latestFindings.map((f) => (
                  <li key={f._id}><Link className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-ink-700/50" to={`/app/scans/${f.scan}?finding=${f._id}`}>
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{f.title}</p><p className="truncate font-mono text-xs muted">{f.filePath}{f.line ? `:${f.line}` : ''}</p></div><SeverityBadge value={f.severity} /></Link></li>))}</ul>)}
            </section>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[[PlusCircle, 'Start a new scan', '/app/new'], [HistoryIcon, 'Compare two scans', '/app/scans'], [Wand2, 'Tune default checks', '/app/settings']].map(([I, t, to]) => (
              <Link key={t} to={to} className="card flex items-center gap-3 p-4 text-sm font-medium transition hover:border-brand-500/50"><I size={18} className="text-brand-500" />{t}</Link>))}
          </div>
        </>
      )}
    </>
  );
}
