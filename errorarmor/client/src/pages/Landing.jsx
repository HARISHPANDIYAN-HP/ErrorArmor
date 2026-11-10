import { Link } from 'react-router-dom';
import { Bug, Cable, ChevronDown, FileSearch, Lock, ShieldCheck, Wand2} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { Logo } from '../components/ui.jsx';
import { SampleReportCard } from './SampleReport.jsx';

const FEATURES = [
  [FileSearch, 'Syntax detection', 'Real parsers find broken JavaScript, JSX, JSON and Python with exact line and column.'],
  [Cable, 'API analysis', 'Matches frontend requests against Express routes to catch wrong paths and HTTP methods.'],
  [Bug, 'Logic bug assistance', 'Flags suspicious conditions, off-by-one loops and async mistakes - clearly labelled as suspicions.'],
  [Lock, 'Security checks', 'Finds exposed secrets (always masked), injection patterns and unsafe configuration.'],
  [Wand2, 'Fix recommendations', 'Plain-language root causes, corrected examples and reviewable diffs. Files are never changed for you.'],
];
const STEPS = ['Upload ZIP or folder', 'Discover files & frameworks', 'Run parsers & analyzers', 'Cross-check API and config', 'Review findings & fixes'];
const TECH = ['JavaScript', 'JSX / React', 'Node.js', 'Express', 'JSON', 'Python', 'package.json', '.env files'];
const FAQ = [
  ['Does ErrorArmor find every bug?', 'No tool can. Findings are labelled by how they were detected - static analysis, heuristic, or confirmed by test - and each shows a confidence score separate from severity.'],
  ['Is my code executed?', 'No. Files are read and analysed statically. Running tests would need an isolated sandbox, so that check is reported as skipped unless one is configured.'],
  ['Is my code sent to an AI service?', 'No. Explanations are rule-based. No external AI provider is connected in this version.'],
  ['Can it scan a folder on my computer?', 'Browsers cannot read folders in place. You can upload a ZIP, or pick a folder and the browser zips it locally before upload.'],
];

export default function Landing() {
  const { user } = useApp();
  const cta = user ? '/app/new' : '/register';
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 dark:from-ink-950 dark:to-ink-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-ink-600/50 dark:bg-ink-950/80">
        <nav className="mx-auto flex max-w-6xl items-center justify-between p-4" aria-label="Primary">
          <Logo />
          <div className="hidden items-center gap-6 text-sm sm:flex"><a href="#features" className="hover:text-brand-500">Features</a><a href="#workflow" className="hover:text-brand-500">How it works</a><a href="#privacy" className="hover:text-brand-500">Privacy</a><a href="#faq" className="hover:text-brand-500">FAQ</a></div>
          <div className="flex gap-2">{user ? <Link to="/app" className="btn-primary">Dashboard</Link> : <><Link to="/login" className="btn-ghost">Log in</Link><Link to="/register" className="btn-primary">Sign up</Link></>}</div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
        <div className="animate-rise">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500"><ShieldCheck size={14} />Scan Deep. Detect Errors. Fix with Confidence.</p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Your Entire Codebase. <span className="bg-gradient-to-r from-brand-400 to-ai-400 bg-clip-text text-transparent">One Intelligent Error Scan.</span></h1>
          <p className="mt-4 max-w-xl text-lg muted">ErrorArmor reads your full-stack project, checks syntax, API contracts, configuration, dependencies and security, then explains each problem in plain language with a practical fix.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link to={cta} className="btn-primary !px-6 !py-3">Start New Scan</Link><a href="#features" className="btn-ghost !px-6 !py-3">Explore Features</a></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-ink-600 bg-ink-950 p-5 font-mono text-xs text-slate-300 shadow-2xl" aria-hidden="true">
          <div className="mb-3 flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-red-500" /><i className="h-2.5 w-2.5 rounded-full bg-amber-500" /><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /></div>
          <pre className="leading-6">{`// frontend/src/api/students.js
export async function load() {
`}<span className="block bg-red-500/20 text-red-300">{"  const res = await fetch('/api/students');"}</span>{`  return res.json();
}

// backend/routes/student.js
`}<span className="block bg-amber-500/20 text-amber-200">{"router.get('/student', list);"}</span></pre>
          <div className="mt-3 rounded-lg border border-brand-500/40 bg-brand-500/10 p-2 text-brand-400">⚠ Potential API route mismatch - /api/students vs /api/student</div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-full"><div className="h-10 animate-scan bg-gradient-to-b from-transparent via-brand-500/25 to-transparent" /></div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12"><h2 className="mb-8 text-center text-3xl font-semibold">Everything you need to debug with confidence</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{FEATURES.map(([I, t, d]) => <div key={t} className="card p-5 transition hover:-translate-y-0.5 hover:border-brand-500/50"><I className="mb-3 text-brand-500" /><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm muted">{d}</p></div>)}</div></section>

      <section id="workflow" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12"><h2 className="mb-8 text-center text-3xl font-semibold">How a scan works</h2>
        <ol className="grid gap-4 sm:grid-cols-5">{STEPS.map((s, i) => <li key={s} className="card relative p-4 text-center"><span className="mx-auto mb-2 grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-sm font-semibold text-white">{i + 1}</span><p className="text-sm">{s}</p></li>)}</ol>
        <div className="mt-8 flex flex-wrap justify-center gap-2">{TECH.map((t) => <span key={t} className="rounded-full border border-slate-300 px-3 py-1 text-xs dark:border-ink-500">{t}</span>)}</div></section>

      <section className="mx-auto max-w-5xl px-4 py-12"><h2 className="mb-6 text-center text-3xl font-semibold">A report you can act on</h2><SampleReportCard /></section>

      <section id="privacy" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-12"><div className="card p-6"><h2 className="mb-3 flex items-center gap-2 text-2xl font-semibold"><Lock className="text-emerald-500" />Security &amp; privacy by design</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">{['Uploaded code is analysed statically and never executed on the web server.', 'Unsafe ZIP paths, oversize archives and unsupported files are rejected.', 'Discovered secrets are masked in the UI, database and exports.', 'Your projects and reports are visible only to you.', 'Delete any scan, project or your entire account at any time.', 'Optional automatic data-retention limits.'].map((x) => <li key={x} className="flex gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-500" />{x}</li>)}</ul></div></section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-12"><h2 className="mb-6 text-center text-3xl font-semibold">Frequently asked questions</h2>
        <div className="space-y-2">{FAQ.map(([q, a]) => <details key={q} className="card group p-4"><summary className="flex cursor-pointer list-none items-center justify-between font-medium">{q}<ChevronDown size={16} className="transition group-open:rotate-180" /></summary><p className="mt-2 text-sm muted">{a}</p></details>)}</div></section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm muted dark:border-ink-600/50"><Logo className="mb-2 justify-center" />Your intelligent companion for finding, understanding, and fixing full-stack development errors.
        <div className="mt-3 flex justify-center gap-4"><a href="#features" className="hover:text-brand-500">Features</a><Link to="/sample" className="hover:text-brand-500">Sample report</Link><Link to="/login" className="hover:text-brand-500">Log in</Link></div></footer>
    </div>
  );
}
