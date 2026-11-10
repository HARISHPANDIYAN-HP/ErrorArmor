import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileArchive, FolderOpen, Info, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { api, errMsg, fieldErrors, unwrap } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { zipFolder, MAX_UPLOAD_MB } from '../lib/zipFolder.js';
import { PageHeader, Spinner } from '../components/ui.jsx';

const OPTIONS = [
  ['syntax', 'Syntax & JSON validity', 'JavaScript/JSX parsing, JSON validity, Python syntax'],
  ['logic', 'Logic & code quality', 'Suspicious conditions, boundaries, async flow, unreachable code'],
  ['api', 'API & integration', 'Frontend/backend route and method matching, CORS, error handling'],
  ['configuration', 'Configuration', 'Env variables, .gitignore, package.json'],
  ['dependencies', 'Dependencies', 'Undeclared and unused packages'],
  ['security', 'Security', 'Secrets (redacted), injection patterns, unsafe settings'],
];

export default function NewScan() {
  const { user, toast } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState(''), [description, setDescription] = useState('');
  const [file, setFile] = useState(null), [info, setInfo] = useState('');
  const [cats, setCats] = useState(() => (user.preferences?.defaultCategories || OPTIONS.map((o) => o[0])).filter((c) => c !== 'tests'));
  const [drag, setDrag] = useState(false), [busy, setBusy] = useState(''), [errors, setErrors] = useState({});
  const abortRef = useRef(null), zipRef = useRef(null), dirRef = useRef(null);

  const takeZip = (f) => {
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) return toast('Drop a .zip file, or use "Select folder" to pick a project folder.', 'error');
    if (f.size > MAX_UPLOAD_MB * 1048576) return toast(`That ZIP is ${(f.size / 1048576).toFixed(1)} MB; the limit is ${MAX_UPLOAD_MB} MB.`, 'error');
    setFile(f); setInfo(`${(f.size / 1024).toFixed(0)} KB ZIP`); if (!name) setName(f.name.replace(/\.zip$/i, ''));
  };
  const takeFolder = async (list) => {
    if (!list?.length) return;
    setBusy('Compressing folder…');
    try {
      const { file: z, kept, skipped } = await zipFolder(list, (p) => setBusy(`Compressing folder… ${p}%`));
      setFile(z); setInfo(`${kept} files included, ${skipped} skipped (node_modules, build output, unsupported types)`); if (!name) setName(z.name.replace(/\.zip$/, ''));
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  };

  const start = async (e) => {
    e.preventDefault(); setErrors({});
    if (!file) return toast('Choose a ZIP file or a project folder first.', 'error');
    if (!cats.length) return toast('Select at least one scan category.', 'error');
    abortRef.current = new AbortController();
    try {
      setBusy('Uploading project…');
      const fd = new FormData(); fd.append('name', name); if (description) fd.append('description', description); fd.append('archive', file);
      const project = unwrap(await api.post('/projects', fd, { signal: abortRef.current.signal })).project;
      setBusy('Starting scan…');
      const scan = unwrap(await api.post(`/projects/${project._id}/scans`, { categories: cats })).scan;
      nav(`/app/scans/${scan._id}/progress`);
    } catch (err) {
      if (err.code !== 'ERR_CANCELED') { setErrors(fieldErrors(err)); toast(errMsg(err), 'error'); }
    } finally { setBusy(''); }
  };
  const cancel = () => { abortRef.current?.abort(); setBusy(''); setFile(null); setInfo(''); };

  return (
    <form onSubmit={start}>
      <PageHeader title="New project scan" sub="Upload a project and choose what to check." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card space-y-4 p-5">
            <div><label className="label" htmlFor="name">Project name</label><input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} aria-invalid={!!errors.name} />{errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}</div>
            <div><label className="label" htmlFor="desc">Description <span className="muted">(optional)</span></label><textarea id="desc" className="input" rows={2} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Project source</h2>
            <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); takeZip(e.dataTransfer.files?.[0]); }}
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${drag ? 'border-brand-500 bg-brand-500/5' : 'border-slate-300 dark:border-ink-500'}`}>
              {file ? (
                <div className="flex items-center justify-center gap-3"><FileArchive className="text-brand-500" /><div className="text-left"><p className="font-medium">{file.name}</p><p className="text-xs muted">{info}</p></div>
                  <button type="button" className="btn-ghost !px-2" onClick={() => { setFile(null); setInfo(''); }} aria-label="Remove file"><X size={16} /></button></div>
              ) : (
                <><UploadCloud className="mx-auto mb-2 text-brand-500" size={32} /><p className="font-medium">Drag &amp; drop a project ZIP here</p><p className="mb-4 text-xs muted">or choose one below · max {MAX_UPLOAD_MB} MB</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" className="btn-ghost" onClick={() => zipRef.current.click()}><FileArchive size={16} />Select ZIP</button>
                    <button type="button" className="btn-ghost" onClick={() => dirRef.current.click()} disabled={!!busy}><FolderOpen size={16} />Select folder</button></div></>
              )}
              <input ref={zipRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => { takeZip(e.target.files[0]); e.target.value = ''; }} />
              <input ref={dirRef} type="file" webkitdirectory="" directory="" multiple className="hidden" onChange={(e) => { takeFolder(e.target.files); e.target.value = ''; }} />
            </div>
            <p className="mt-3 flex gap-2 text-xs muted"><Info size={14} className="mt-0.5 shrink-0" />Browsers cannot read a folder in place, so the folder is zipped in your browser first. A local scanning agent is not part of this version.</p>
            <p className="mt-2 text-xs muted">Supported: .js .jsx .mjs .cjs .json .py .html .css .vue .md .yml .env* and similar. <b>Excluded automatically:</b> node_modules, .git, dist, build, caches, files over 1 MB.</p>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Scan categories</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {OPTIONS.map(([id, label, hint]) => (
                <label key={id} className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 dark:border-ink-600/60">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-500" checked={cats.includes(id)} onChange={() => setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))} />
                  <span><span className="block text-sm font-medium">{label}</span><span className="text-xs muted">{hint}</span></span>
                </label>))}
              <label className="flex gap-3 rounded-xl border border-dashed border-slate-300 p-3 opacity-60 dark:border-ink-500"><input type="checkbox" disabled className="mt-1 h-4 w-4" />
                <span><span className="block text-sm font-medium">Run project tests</span><span className="text-xs muted">Unavailable: needs an isolated sandbox, which is not configured on this server.</span></span></label>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card p-5"><h2 className="mb-2 flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-emerald-500" />Privacy &amp; processing</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm muted"><li>Files are read as text and analysed statically. Your code is never executed on the server.</li><li>Only findings and short, redacted snippets are stored in the database.</li><li>Detected secrets are masked everywhere.</li><li>No source is sent to any external AI service.</li><li>Delete a project any time from Scan history.</li></ul></div>
          <div className="card space-y-2 p-5">
            <button className="btn-primary w-full" disabled={!!busy || !file}>{busy ? <><Spinner />{busy}</> : 'Start scan'}</button>
            <button type="button" className="btn-ghost w-full" onClick={cancel} disabled={!busy && !file}>Cancel</button>
          </div>
        </aside>
      </div>
    </form>
  );
}
