import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export const InitialAdminSetup: React.FC = () => {
  const navigate = useNavigate();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ available: boolean }>('/auth/initial-admin-status')
      .then((result) => setAvailable(result.available))
      .catch(() => setAvailable(false));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 12) { setError('Use a password with at least 12 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await api.post('/auth/initial-admin', { full_name: fullName, email, password, confirm_password: confirmPassword });
      navigate('/login', { replace: true, state: { setupComplete: true } });
    } catch (err: any) {
      setError(err.message || 'Could not create administrator.');
      setAvailable(false);
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <section className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">RO</div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Initial administrator setup</h1>
          <p className="mt-2 text-sm text-slate-500">Create the first approved administrator for this CRM.</p>
        </div>
        {available === null ? <p className="text-sm text-slate-500">Checking setup availability…</p> : !available ? (
          <div className="text-sm text-slate-700 space-y-4">
            <p>Initial setup is unavailable. It may be disabled or an administrator may already exist.</p>
            <Link className="text-blue-600 font-semibold" to="/login">Return to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 p-3 rounded-lg">{error}</p>}
            <label className="block text-sm font-medium">Full name<input required minLength={2} value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 w-full border rounded-lg p-2.5" /></label>
            <label className="block text-sm font-medium">Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full border rounded-lg p-2.5" /></label>
            <label className="block text-sm font-medium">Password (minimum 12 characters)<input required minLength={12} type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full border rounded-lg p-2.5" /></label>
            <label className="block text-sm font-medium">Confirm password<input required minLength={12} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 w-full border rounded-lg p-2.5" /></label>
            <button disabled={busy} className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold p-3 disabled:opacity-50">{busy ? 'Creating administrator…' : 'Create administrator'}</button>
            <p className="text-xs text-slate-500">This page works only when explicitly enabled and no administrator account exists.</p>
          </form>
        )}
      </section>
    </main>
  );
};
