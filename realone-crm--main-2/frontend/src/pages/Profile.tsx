import React from 'react';
import { User, ShieldCheck, Mail, Calendar, KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Profile: React.FC = () => {
  const { user, role } = useAuth();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-600" /> User Profile & Security
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Your account credentials, CRM access permissions, and session status
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white font-bold text-xl flex items-center justify-center shadow-md">
            {user?.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{user?.full_name}</h2>
            <p className="text-xs text-slate-500">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                {role}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approved & Active
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 font-semibold block mb-1">User ID</span>
            <span className="font-mono text-slate-800 text-sm">{user?.id}</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 font-semibold block mb-1">Registered Since</span>
            <span className="text-slate-800 text-sm">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>

        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 text-xs space-y-1 text-slate-700">
          <p className="font-semibold text-blue-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> Role-Based Access Privileges
          </p>
          {role === 'admin' ? (
            <p className="text-slate-600 leading-relaxed">
              As an Administrator, you have full privileges to view and assign all CRM leads, configure Meta Lead Ads synchronization, approve or reject account signups, and monitor live round-robin rotation.
            </p>
          ) : (
            <p className="text-slate-600 leading-relaxed">
              As an Agent, you have access exclusively to leads assigned to your account via the persistent round-robin distribution engine. All lead edits and status progressions are logged to the audit history.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
