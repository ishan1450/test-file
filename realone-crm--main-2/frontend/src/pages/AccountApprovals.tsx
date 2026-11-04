import React, { useState, useEffect } from 'react';
import { UserCheck, Check, X, RefreshCw, Clock, ShieldAlert } from 'lucide-react';
import { userService } from '../services/userService';
import { User } from '../types/auth';

export const AccountApprovals: React.FC = () => {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const fetchPending = async () => {
    setIsLoading(true);
    try {
      const data = await userService.getPendingUsers();
      setPendingUsers(data);
    } catch {
      setPendingUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleDecision = async (userId: number, action: 'approve' | 'reject') => {
    setActionLoadingId(userId);
    try {
      await userService.updateApproval(userId, action);
      await fetchPending();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} user`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" /> Account Registrations & Approvals
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review pending signups. Approved accounts are granted the Agent role and added to round-robin rotation.
          </p>
        </div>
        <button
          onClick={fetchPending}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh List
        </button>
      </div>

      {/* Approvals Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>Loading pending accounts...</span>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="py-20 text-center">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No Pending Registrations</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              All registration requests have been reviewed. New signups will appear here for admin authorization.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Requested Role</th>
                  <th className="py-3 px-4">Registration Date</th>
                  <th className="py-3 px-4 text-right">Approval Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{u.full_name}</p>
                      <p className="text-slate-500 text-[11px]">{u.email}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        Agent (Default)
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {new Date(u.created_at).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={actionLoadingId === u.id}
                          onClick={() => handleDecision(u.id, 'reject')}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-xs flex items-center gap-1 border border-rose-200 transition-colors disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button
                          disabled={actionLoadingId === u.id}
                          onClick={() => handleDecision(u.id, 'approve')}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 shadow-sm transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve as Agent
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
