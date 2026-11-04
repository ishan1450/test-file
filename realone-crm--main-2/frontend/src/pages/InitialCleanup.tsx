import React, { useState } from 'react';
import { api } from '../services/api';

type CleanupResult = {
  message: string;
  leads_deleted: number;
  lead_activities_deleted: number;
  agents_deleted: number;
  admin_preserved: number;
  meta_integration_preserved: boolean;
};

export const InitialCleanup: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CleanupResult | null>(null);

  const runCleanup = async () => {
    const confirmed = window.confirm(
      'This permanently deletes ALL leads, their activity history, and ALL agent accounts. The signed-in admin and Meta integration settings are preserved. Continue only after taking a database backup.'
    );
    if (!confirmed) return;

    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await api.post<CleanupResult>('/maintenance/initial-cleanup');
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Cleanup failed. No changes should be assumed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Temporary one-time tool</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Initial CRM cleanup</h1>
        <p className="text-sm text-slate-600 mt-2">This operation removes the existing dummy leads and agent accounts so you can start with a clean CRM.</p>
      </div>
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-2 text-sm text-amber-950">
        <strong>What will be deleted</strong>
        <ul className="list-disc pl-5 space-y-1">
          <li>Every lead and its related activity history</li>
          <li>Every account with the Agent role, including pending or rejected agent accounts</li>
        </ul>
        <strong className="block pt-2">What will be preserved</strong>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your signed-in administrator account</li>
          <li>Meta integration credentials, configuration, and existing sync logs</li>
          <li>Database schema, settings, and other CRM configuration</li>
        </ul>
        <p className="pt-2">Old Meta lead IDs are recorded as already processed to prevent the automatic historical sync from recreating deleted dummy leads.</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 text-rose-700 p-3 text-sm">{error}</p>}
      {result && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 space-y-1">
          <strong>{result.message}</strong>
          <p>Leads deleted: {result.leads_deleted}</p>
          <p>Lead activities deleted: {result.lead_activities_deleted}</p>
          <p>Agent accounts deleted: {result.agents_deleted}</p>
          <p>Administrator preserved (user ID): {result.admin_preserved}</p>
          <p>Meta integration preserved: {result.meta_integration_preserved ? 'Yes' : 'No'}</p>
        </div>
      )}
      <button onClick={runCleanup} disabled={busy || !!result} className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold px-5 py-3 disabled:opacity-50">
        {busy ? 'Cleaning database…' : result ? 'Cleanup completed' : 'Permanently delete dummy data'}
      </button>
      <p className="text-xs text-slate-500">This endpoint is admin-protected, controlled by a Render environment flag, and can succeed only once.</p>
    </div>
  );
};
