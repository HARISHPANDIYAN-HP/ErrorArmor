import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { errMsg, fieldErrors } from '../lib/api.js';
import { Logo, Spinner } from '../components/ui.jsx';

function Shell({ title, sub, children, footer }) {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-slate-100 to-white p-4 dark:from-ink-950 dark:to-ink-900">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-semibold">{title}</h1><p className="mb-6 mt-1 text-sm muted">{sub}</p>
          {children}
        </div>
        <p className="mt-4 text-center text-sm muted">{footer}</p>
      </div>
    </div>
  );
}

function useAuthForm(action) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [fields, setFields] = useState({});
  const nav = useNavigate();
  const submit = async (e, ...args) => {
    e.preventDefault(); setBusy(true); setError(''); setFields({});
    try { await action(...args); nav('/app'); } catch (err) { setError(errMsg(err)); setFields(fieldErrors(err)); } finally { setBusy(false); }
  };
  return { busy, error, fields, submit };
}

const Field = ({ label, error, ...p }) => (
  <div><label className="label" htmlFor={p.name}>{label}</label>
    <input id={p.name} className="input" aria-invalid={!!error} aria-describedby={error ? `${p.name}-err` : undefined} required {...p} />
    {error && <p id={`${p.name}-err`} className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

export function Login() {
  const { user, login } = useApp();
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const { busy, error, fields, submit } = useAuthForm(login);
  if (user) return <Navigate to="/app" replace />;
  return (
    <Shell title="Welcome back" sub="Log in to continue scanning." footer={<>New here? <Link className="text-brand-500 hover:underline" to="/register">Create an account</Link></>}>
      <form onSubmit={(e) => submit(e, email, password)} className="space-y-4" noValidate>
        {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
        <Field label="Email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} />
        <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner />}Log in</button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { user, register } = useApp();
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const { busy, error, fields, submit } = useAuthForm(register);
  if (user) return <Navigate to="/app" replace />;
  return (
    <Shell title="Create your account" sub="Start finding errors in minutes." footer={<>Already registered? <Link className="text-brand-500 hover:underline" to="/login">Log in</Link></>}>
      <form onSubmit={(e) => submit(e, name, email, password)} className="space-y-4" noValidate>
        {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
        <Field label="Name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={fields.name} />
        <Field label="Email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} />
        <Field label="Password" name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} />
        <p className="text-xs muted">At least 8 characters with a letter and a number. Passwords are hashed with bcrypt.</p>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner />}Create account</button>
      </form>
    </Shell>
  );
}
