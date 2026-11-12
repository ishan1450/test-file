import React, { useState, useEffect } from 'react';
import { Users, ShieldCheck, CheckCircle2, XCircle, RefreshCw, Power } from 'lucide-react';
import { userService } from '../services/userService';
import { User } from '../types/auth';

export const Agents: React.FC = () => {
  const [agents, setAgents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchAgents = async () => {
    setIsLoading(true);
    try {
      const data = await userService.getUsers('agent', 'approved');
      setAgents(data.filter((a) => a.approval_status === 'approved'));
    } catch {
      setAgents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleToggleStatus = async (user: User) => {
    setTogglingId(user.id);
    try {
      await userService.updateStatus(user.id, !user.is_active);
      await fetchAgents();
    } catch (err: any) {
      alert(err.message || 'Failed to update agent status');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> Team Agents & Round-Robin Rotation
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Active agents receive leads sequentially via the mandatory Round-Robin engine. Deactivated agents are skipped automatically.
          </p>
        </div>
        <button
          onClick={fetchAgents}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Agents Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>Loading team agents...</span>
          </div>
        ) : agents.length === 0 ? (
          <div className="py-20 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No agents registered</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Agent Name</th>
                  <th className="py-3 px-4">Approval Status</th>
                  <th className="py-3 px-4">Round-Robin Status</th>
                  <th className="py-3 px-4">Date Approved</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{agent.full_name}</p>
                      <p className="text-slate-500 text-[11px]">{agent.email}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 capitalize">
                        {agent.approval_status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {agent.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active (Receiving Leads)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Inactive (Skipped in Rotation)
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {agent.approved_at ? new Date(agent.approved_at).toLocaleDateString() : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        disabled={togglingId === agent.id}
                        onClick={() => handleToggleStatus(agent)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors ${
                          agent.is_active
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{agent.is_active ? 'Deactivate' : 'Activate'}</span>
                      </button>
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
