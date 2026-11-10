import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, MinusCircle, ShieldCheck, XCircle } from 'lucide-react';

export function Logo({ className = '' }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-semibold ${className}`} aria-label="ErrorArmor home">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/30"><ShieldCheck size={18} /></span>
      <span className="text-lg">Error<span className="text-brand-500">Armor</span></span>
    </Link>
  );
}

export const SEVERITY_STYLE = {
  critical: 'bg-red-500/15 text-red-500 ring-red-500/30', high: 'bg-orange-500/15 text-orange-500 ring-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-500 ring-amber-500/30', low: 'bg-blue-500/15 text-blue-400 ring-blue-500/30', info: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
};
export const SEVERITY_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#94a3b8' };
export const CAT_LABEL = { syntax: 'Syntax', type: 'Type', logic: 'Logic', api: 'API', frontend: 'Frontend', backend: 'Backend', database: 'Database', integration: 'Integration', runtime: 'Runtime', dependency: 'Dependency', configuration: 'Configuration', auth: 'Auth', security: 'Security', performance: 'Performance', accessibility: 'Accessibility', test: 'Tests', build: 'Build', quality: 'Quality' };
const VERIF = {
  'confirmed-by-test': ['Confirmed by test', 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30'],
  'static-analysis': ['Static analysis', 'bg-brand-500/15 text-brand-400 ring-brand-500/30'],
  heuristic: ['Suspected (heuristic)', 'bg-amber-500/15 text-amber-500 ring-amber-500/30'],
  'ai-suggested': ['AI-suggested', 'bg-ai-500/15 text-ai-400 ring-ai-500/30'],
  'false-positive': ['False positive', 'bg-slate-500/15 text-slate-400 ring-slate-500/30'],
  resolved: ['Resolved after verification', 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30'],
};
const pill = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize';
export const SeverityBadge = ({ value }) => <span className={`${pill} ${SEVERITY_STYLE[value] || SEVERITY_STYLE.info}`}>{value}</span>;
export const VerificationBadge = ({ value }) => <span className={`${pill} normal-case ${VERIF[value]?.[1] || ''}`}>{VERIF[value]?.[0] || value}</span>;
export const StatusBadge = ({ value }) => {
  const m = { completed: 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30', running: 'bg-brand-500/15 text-brand-400 ring-brand-500/30', queued: 'bg-slate-500/15 text-slate-400 ring-slate-500/30', failed: 'bg-red-500/15 text-red-500 ring-red-500/30', cancelled: 'bg-amber-500/15 text-amber-500 ring-amber-500/30' };
  return <span className={`${pill} ${m[value]}`}>{value}</span>;
};
export const ConfidenceBar = ({ value }) => (
  <span className="inline-flex items-center gap-2 text-xs muted" title="How sure the scanner is (separate from severity)">
    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-ink-600"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.round(value * 100)}%` }} /></span>{Math.round(value * 100)}%
  </span>
);

export const Skeleton = ({ className = 'h-6 w-full' }) => <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-ink-700 ${className}`} aria-hidden="true" />;
export const Spinner = ({ size = 16 }) => <Loader2 size={size} className="animate-spin" aria-label="Loading" />;

export function Empty({ icon: Icon = ShieldCheck, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500"><Icon size={22} /></span>
      <h3 className="font-semibold">{title}</h3>
      {children && <p className="max-w-md text-sm muted">{children}</p>}
      {action}
    </div>
  );
}

export const StatCard = ({ label, value, icon: Icon, tone = 'text-brand-500' }) => (
  <div className="card p-4">
    <div className="flex items-center justify-between"><span className="text-sm muted">{label}</span>{Icon && <Icon size={18} className={tone} />}</div>
    <div className="mt-2 text-2xl font-semibold tabular-nums">{value ?? <Skeleton className="h-8 w-16" />}</div>
  </div>
);

export const CheckIcon = ({ status }) =>
  status === 'passed' ? <CheckCircle2 size={16} className="text-emerald-500" aria-label="passed" />
    : status === 'failed' ? <XCircle size={16} className="text-red-500" aria-label="failed" />
      : status === 'skipped' ? <MinusCircle size={16} className="text-slate-400" aria-label="skipped" />
        : <AlertTriangle size={16} className="text-amber-500" />;

export function DiffView({ diff }) {
  if (!diff) return null;
  return (
    <pre className="code" aria-label="Proposed diff">
      {diff.split('\n').map((l, i) => (
        <div key={i} className={l.startsWith('+') && !l.startsWith('+++') ? 'bg-emerald-500/15 text-emerald-300' : l.startsWith('-') && !l.startsWith('---') ? 'bg-red-500/15 text-red-300' : l.startsWith('@@') ? 'text-ai-400' : 'text-slate-400'}>{l || ' '}</div>
      ))}
    </pre>
  );
}

export const PageHeader = ({ title, children, sub }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-semibold">{title}</h1>{sub && <p className="mt-1 text-sm muted">{sub}</p>}</div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

export const Pager = ({ meta, onPage }) => meta && meta.pages > 1 ? (
  <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm dark:border-ink-600/60">
    <span className="muted">Page {meta.page} of {meta.pages} · {meta.total} total</span>
    <div className="flex gap-2">
      <button className="btn-ghost" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</button>
      <button className="btn-ghost" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next</button>
    </div>
  </div>
) : null;
