import { Link } from 'react-router-dom';
import { sampleReport } from '../lib/sampleReport.js';
import { ConfidenceBar, Logo, SeverityBadge, VerificationBadge } from '../components/ui.jsx';

export function SampleReportCard() {
  const s = sampleReport.summary;
  const stats = [['Files analyzed', s.filesAnalyzed], ['Confirmed test failures', s.confirmedFailures], ['Static findings', s.staticFindings], ['Suspected logic', s.suspectedLogic], ['Warnings', s.warnings], ['Checks passed', s.passed]];
  return (
    <div className="card overflow-hidden text-left">
      <div className="flex items-center justify-between border-b border-slate-200 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-600 dark:border-ink-600/60 dark:text-amber-400"><span>DEMONSTRATION DATA - not from a real scan</span><span>{sampleReport.project}</span></div>
      <div className="grid grid-cols-2 gap-px bg-slate-200 dark:bg-ink-600/60 sm:grid-cols-6">{stats.map(([k, v]) => <div key={k} className="bg-white p-3 dark:bg-ink-800"><p className="text-xs muted">{k}</p><p className="text-xl font-semibold tabular-nums">{v}</p></div>)}</div>
      <ul className="divide-y divide-slate-200 dark:divide-ink-600/60">{sampleReport.findings.map((f) => (
        <li key={f.id} className="space-y-1 p-4"><div className="flex flex-wrap items-center gap-2"><SeverityBadge value={f.severity} /><span className="font-medium">{f.title}</span><VerificationBadge value={f.verification} /><span className="ml-auto"><ConfidenceBar value={f.confidence} /></span></div>
          <p className="font-mono text-xs muted">{f.file}{f.line ? `:${f.line}` : ''}</p><p className="text-sm">{f.why}</p><p className="text-sm"><b>Fix:</b> {f.fix}</p></li>))}</ul>
    </div>
  );
}

export default function SampleReport() {
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between"><Logo /><Link className="btn-primary" to="/register">Start new scan</Link></div>
      <h1 className="mb-4 text-2xl font-semibold">Sample scan report</h1>
      <SampleReportCard />
    </div>
  );
}
