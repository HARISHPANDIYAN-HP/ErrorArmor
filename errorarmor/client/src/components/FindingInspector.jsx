import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Check, Copy, FlaskConical, GitCompare, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { api, errMsg, unwrap } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { CAT_LABEL, ConfidenceBar, DiffView, SeverityBadge, Skeleton, Spinner, VerificationBadge } from './ui.jsx';

const Section = ({ title, children, ai }) => children ? (
  <section className={ai ? 'rounded-xl border border-ai-500/30 bg-ai-500/5 p-4' : ''}>
    <h3 className={`mb-1 flex items-center gap-1.5 text-sm font-semibold ${ai ? 'text-ai-400' : ''}`}>{ai && <Sparkles size={14} />}{title}</h3>
    <div className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{children}</div>
  </section>
) : null;

export default function FindingInspector({ id, onClose, onChanged }) {
  const { toast } = useApp();
  const [f, setF] = useState(null), [busy, setBusy] = useState('');
  const load = useCallback(() => api.get(`/findings/${id}`).then((r) => setF(unwrap(r).finding)).catch((e) => { toast(errMsg(e), 'error'); onClose(); }), [id, toast, onClose]);
  useEffect(() => { setF(null); load(); }, [load]);
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const run = async (key, fn, okMsg) => { setBusy(key); try { await fn(); if (okMsg) toast(okMsg, 'success'); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(''); } };
  const copy = (text, msg) => navigator.clipboard.writeText(text).then(() => toast(msg, 'success')).catch(() => toast('Clipboard is not available', 'error'));
  const setStatus = (reviewStatus, msg) => run(reviewStatus, async () => { setF(unwrap(await api.patch(`/findings/${id}/status`, { reviewStatus })).finding); onChanged?.(); }, msg);

  const details = f && [`${f.title} [${f.severity}/${f.category}]`, `${f.filePath || ''}${f.line ? ':' + f.line : ''}`, f.description, `Root cause: ${f.rootCause || '-'}`, `Fix: ${f.suggestedFix || '-'}`].join('\n');

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Finding details">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-2xl animate-rise flex-col overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-ink-600 dark:bg-ink-800">
        <button className="btn-ghost absolute right-3 top-3 !px-2" onClick={onClose} aria-label="Close"><X size={18} /></button>
        {!f ? <div className="space-y-3 pt-8"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-24" /><Skeleton className="h-32" /></div> : (
          <div className="space-y-5 pr-8">
            <header>
              <div className="mb-2 flex flex-wrap items-center gap-2"><SeverityBadge value={f.severity} /><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-ink-700">{CAT_LABEL[f.category] || f.category}</span><VerificationBadge value={f.verificationStatus} />
                {f.reviewStatus !== 'open' && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize dark:bg-ink-700">{f.reviewStatus.replace('-', ' ')}</span>}</div>
              <h2 className="text-xl font-semibold">{f.title}</h2>
              <p className="mt-1 font-mono text-xs muted">{f.filePath}{f.line ? `:${f.line}` : ''}{f.column ? `:${f.column}` : ''}</p>
              <div className="mt-2 flex items-center gap-2 text-xs"><span className="muted">Confidence</span><ConfidenceBar value={f.confidence} /></div>
            </header>

            {f.codeSnippet && <section><h3 className="mb-1 text-sm font-semibold">Code</h3><pre className="code">{f.codeSnippet.split('\n').map((l, i) => <div key={i} className={l.includes(' > ') ? 'bg-red-500/20' : ''}>{l}</div>)}</pre></section>}
            <Section title="What is wrong">{f.description}</Section>
            <Section title="Root cause" ai>{f.rootCause}</Section>
            <Section title="Why it matters">{f.why}</Section>
            <Section title="Recommended fix">{f.suggestedFix}</Section>
            {f.correctedExample && <section><h3 className="mb-1 text-sm font-semibold">Corrected example</h3><pre className="code">{f.correctedExample}</pre></section>}
            {f.relatedFiles?.length > 0 && <Section title="Related files">{f.relatedFiles.map((p) => <div key={p} className="font-mono text-xs">{p}</div>)}</Section>}
            <Section title="How to reproduce">{f.howToReproduce}</Section>
            <Section title="How to verify the fix">{f.howToVerify}</Section>
            {f.docsUrl && <a className="inline-flex items-center gap-1 text-sm text-brand-500 hover:underline" href={f.docsUrl} target="_blank" rel="noreferrer noopener"><BookOpen size={14} />Official documentation</a>}

            {f.proposedPatch?.status === 'proposed' && (
              <section><h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><GitCompare size={14} />Proposed patch (review only)</h3>
                <DiffView diff={f.proposedPatch.diff} /><p className="mt-2 whitespace-pre-wrap text-xs muted">{f.proposedPatch.note}</p>
                {f.proposedPatch.diff && <button className="btn-ghost mt-2" onClick={() => copy(f.proposedPatch.diff, 'Diff copied')}><Copy size={14} />Copy diff</button>}</section>
            )}

            <footer className="sticky bottom-0 -mx-5 -mb-5 space-y-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur dark:border-ink-600 dark:bg-ink-800/95">
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => copy(details, 'Finding copied')}><Copy size={14} />Copy details</button>
                <button className="btn-ghost" onClick={() => copy(`${f.suggestedFix || ''}${f.correctedExample ? '\n\n' + f.correctedExample : ''}`, 'Fix copied')}><Copy size={14} />Copy fix</button>
                <button className="btn-ghost" disabled={!!busy} onClick={() => setStatus('reviewed', 'Marked as reviewed')}><Check size={14} />Reviewed</button>
                <button className="btn-ghost" disabled={!!busy} onClick={() => setStatus(f.reviewStatus === 'false-positive' ? 'open' : 'false-positive', f.reviewStatus === 'false-positive' ? 'Reopened' : 'Marked as false positive')}>{f.reviewStatus === 'false-positive' ? 'Reopen' : 'False positive'}</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-primary" disabled={!!busy} onClick={() => run('patch', async () => { await api.post(`/findings/${id}/propose-fix`); await load(); }, 'Patch proposal ready')}>{busy === 'patch' ? <Spinner /> : <FlaskConical size={14} />}Propose patch</button>
                <button className="btn-ghost" disabled={!!busy} onClick={() => run('verify', async () => { const r = unwrap(await api.post(`/findings/${id}/verify-fix`)); toast(r.message, r.stillPresent ? 'info' : 'success'); await load(); onChanged?.(); })}>{busy === 'verify' ? <Spinner /> : <RefreshCw size={14} />}Run check again</button>
                <span className="ml-auto flex items-center gap-1 text-xs muted">Helpful?
                  {[true, false].map((h) => <button key={String(h)} className="btn-ghost !px-2 !py-1" aria-label={h ? 'Helpful' : 'Not helpful'} onClick={() => run('fb', () => api.post(`/findings/${id}/feedback`, { helpful: h }), 'Thanks for the feedback')}>{h ? <ThumbsUp size={13} /> : <ThumbsDown size={13} />}</button>)}</span>
              </div>
              <p className="text-xs muted">ErrorArmor never edits your files. &ldquo;Run check again&rdquo; re-checks the stored snapshot; to verify local edits, scan an updated ZIP.</p>
            </footer>
          </div>
        )}
      </aside>
    </div>
  );
}
