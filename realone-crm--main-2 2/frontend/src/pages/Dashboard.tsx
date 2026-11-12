import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  TrendingUp,
  Award,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Share2,
  CheckCircle2,
  UserCheck2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/dashboardService';
import { DashboardStats, AdminDashboardStats, AgentDashboardStats } from '../types/dashboard';

const STATUS_COLORS: Record<string, string> = {
  New: '#3b82f6',
  Contacted: '#0ea5e9',
  Qualified: '#8b5cf6',
  Negotiation: '#f59e0b',
  Won: '#10b981',
  Lost: '#ef4444',
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
        <span className="text-sm font-medium">Loading dashboard overview...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-xl text-center">
        <p className="text-sm font-medium">{error || 'Could not load statistics'}</p>
        <button
          onClick={fetchStats}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try Again
        </button>
      </div>
    );
  }

  // ADMIN DASHBOARD
  if (stats.role === 'admin') {
    const adminStats = stats as AdminDashboardStats;

    return (
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Welcome back, {user?.full_name}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Real One Management Overview • All Leads Across Agents & Admins
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/leads?action=new"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" /> Add Lead
            </Link>
            <Link
              to="/leads"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200"
            >
              <span>View All Leads</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/meta"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-600" /> Meta Lead Ads
            </Link>
          </div>
        </div>

        {/* Pending Approval Banner if any */}
        {adminStats.pending_registrations > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                {adminStats.pending_registrations}
              </div>
              <div>
                <h2 className="text-xs font-bold text-amber-900">
                  {adminStats.pending_registrations} Account Registration{adminStats.pending_registrations > 1 ? 's' : ''} Pending Approval
                </h2>
                <p className="text-[11px] text-amber-700">New agents cannot receive leads until verified</p>
              </div>
            </div>
            <Link
              to="/approvals"
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-sm"
            >
              Review Now <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Leads</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-slate-900">{adminStats.total_leads}</span>
              <Building2 className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">All Agents & Admins</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">New Leads</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-blue-600">{adminStats.new_leads}</span>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Awaiting Contact</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Qualified</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-purple-600">{adminStats.qualified_leads}</span>
              <TrendingUp className="w-4 h-4 text-purple-500" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Active Inquiries</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Deals Won</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-emerald-600">{adminStats.won_leads}</span>
              <Award className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Closed Transactions</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Agents</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-slate-900">{adminStats.active_agent_count}</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">In Lead Rotation</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Unassigned</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className={`text-2xl font-bold ${adminStats.unassigned_leads > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {adminStats.unassigned_leads}
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Available for Pickup</span>
          </div>
        </div>

        {/* Status Pipeline Cards */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Lead Lifecycle Pipeline
            </h2>
            <Link to="/leads" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
              Filter by Status →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {adminStats.leads_by_status.map((item) => (
              <Link
                key={item.status}
                to={`/leads?status=${item.status}`}
                className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-100/80 transition-colors flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{item.status}</span>
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[item.status] || '#64748b' }}
                  ></span>
                </div>
                <span className="text-xl font-bold text-slate-900 mt-2">{item.count}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Agent Round-Robin Distribution Table (Full Width) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Agent Round-Robin Distribution & Team Performance
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automated persistent rotation across verified sales agents.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/agents"
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
              >
                Manage Agents →
              </Link>
              <Link
                to="/leads"
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                View Leads
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="pb-3 font-semibold">Team Member</th>
                  <th className="pb-3 font-semibold">Email</th>
                  <th className="pb-3 font-semibold">Rotation Status</th>
                  <th className="pb-3 font-semibold text-right">Total Leads Assigned</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adminStats.leads_per_agent.map((agent) => (
                  <tr key={agent.agent_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                          {agent.agent_name.charAt(0)}
                        </div>
                        <span className="font-semibold text-slate-900">{agent.agent_name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-slate-500 font-mono text-[11px]">{agent.email}</td>
                    <td className="py-3.5">
                      {agent.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active in Rotation
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          Paused / Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-right">
                      <span className="text-sm font-bold text-slate-900">{agent.lead_count}</span>
                    </td>
                    <td className="py-3.5 text-right">
                      <Link
                        to={`/leads?agent_id=${agent.agent_id}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        View Assigned Leads →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // AGENT DASHBOARD
  const agentStats = stats as AgentDashboardStats;
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Agent Workspace: {user?.full_name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track and nurture your assigned real estate leads
          </p>
        </div>
        <Link
          to="/leads"
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Building2 className="w-3.5 h-3.5" /> View My Leads
        </Link>
      </div>

      {/* Agent Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">My Total Leads</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-slate-900">{agentStats.total_leads}</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">New Assigned</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-blue-600">{agentStats.new_leads}</span>
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Qualified</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-purple-600">{agentStats.qualified_leads}</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Closed Won</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-emerald-600">{agentStats.won_leads}</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Assigned Leads Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Recently Updated Assigned Leads
          </h2>
          <Link to="/leads" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
            View All ({agentStats.total_leads}) →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2.5 font-semibold">Lead Name</th>
                <th className="pb-2.5 font-semibold">Source</th>
                <th className="pb-2.5 font-semibold">Status</th>
                <th className="pb-2.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agentStats.recent_leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5">
                    <span className="font-semibold text-slate-900">{lead.full_name}</span>
                    <p className="text-[11px] text-slate-400">{lead.phone}</p>
                  </td>
                  <td className="py-2.5 text-slate-600">{lead.source}</td>
                  <td className="py-2.5">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: STATUS_COLORS[lead.status] || '#64748b' }}
                    >
                      {lead.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <Link
                      to={`/leads/${lead.id}`}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
