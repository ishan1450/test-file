import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Search,
  Filter,
  Plus,
  Archive,
  RefreshCw,
  Eye,
  Edit2,
  CheckCircle,
  ArchiveRestore,
  ExternalLink,
  Share2,
  DownloadCloud,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { leadService } from '../services/leadService';
import { userService } from '../services/userService';
import { Lead, LeadFilterParams } from '../types/lead';
import { User } from '../types/auth';
import { LeadModal } from '../components/LeadModal';

const STATUS_BADGES: Record<string, { bg: string; text: string; dot: string }> = {
  New: { bg: 'bg-blue-50 text-blue-700 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  Contacted: { bg: 'bg-sky-50 text-sky-700 border-sky-200', text: 'text-sky-700', dot: 'bg-sky-500' },
  Qualified: { bg: 'bg-purple-50 text-purple-700 border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  Negotiation: { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  Won: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Lost: { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
};

export const Leads: React.FC = () => {
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [agents, setAgents] = useState<User[]>([]);

  // Filter state
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('source') || '');
  const [propertyType, setPropertyType] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [agentId, setAgentId] = useState<number | undefined>(
    searchParams.get('agent_id') ? Number(searchParams.get('agent_id')) : undefined
  );
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams();
      if (agentId !== undefined) params.append('agent_id', String(agentId));
      if (statusFilter) params.append('status', statusFilter);
      if (sourceFilter) params.append('source', sourceFilter);

      const res = await fetch(`/api/v1/leads/export/csv?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to export leads');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_all_agents_and_admins_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(searchParams.get('action') === 'new');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const fetchAgents = async () => {
    if (role === 'admin') {
      try {
        const list = await userService.getAgents();
        setAgents(list);
      } catch {
        // Ignore
      }
    }
  };

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const params: LeadFilterParams = {
        search: search || undefined,
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
        property_type: propertyType || undefined,
        preferred_location: locationFilter || undefined,
        agent_id: role === 'admin' ? agentId : undefined,
        archived_only: archivedOnly,
        page: currentPage,
        size: pageSize,
      };
      const res = await leadService.getLeads(params);
      setLeads(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch {
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [role]);

  useEffect(() => {
    fetchLeads();
  }, [search, statusFilter, sourceFilter, propertyType, locationFilter, agentId, archivedOnly, currentPage]);

  const handleArchiveToggle = async (lead: Lead) => {
    try {
      if (lead.archived_at) {
        await leadService.restoreLead(lead.id);
      } else {
        if (!window.confirm(`Are you sure you want to archive lead "${lead.full_name}"?`)) return;
        await leadService.archiveLead(lead.id);
      }
      fetchLeads();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  const handleLeadSaved = () => {
    setIsModalOpen(false);
    setEditingLead(null);
    fetchLeads();
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {role === 'admin' ? 'All CRM Leads' : 'My Assigned Leads'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {total} total records found • Strict assignment isolation enforced
          </p>
        </div>

        <div className="flex items-center gap-2">
          {role === 'admin' && (
            <>
              <button
                onClick={handleExportCSV}
                disabled={isExporting}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                title="Download CSV of leads across all agents and admins"
              >
                <DownloadCloud className={`w-3.5 h-3.5 text-blue-600 ${isExporting ? 'animate-bounce' : ''}`} />
                <span>{isExporting ? 'Exporting...' : 'Export All Leads (CSV)'}</span>
              </button>

              <button
                onClick={() => {
                  setArchivedOnly(!archivedOnly);
                  setCurrentPage(1);
                }}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                  archivedOnly
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {archivedOnly ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                <span>{archivedOnly ? 'Viewing Archived' : 'Archived Leads'}</span>
              </button>
            </>
          )}

          <button
            onClick={() => {
              setEditingLead(null);
              setIsModalOpen(true);
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add New Lead
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, phone, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Qualified">Qualified</option>
            <option value="Negotiation">Negotiation</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
          >
            <option value="">All Sources</option>
            <option value="Facebook Lead Ads">Facebook Lead Ads</option>
            <option value="Instagram Lead Ads">Instagram Lead Ads</option>
            <option value="Website">Website</option>
            <option value="Phone Call">Phone Call</option>
            <option value="Referral">Referral</option>
            <option value="Walk-in">Walk-in</option>
            <option value="Other">Other</option>
          </select>

          {/* Agent & Admin Assignee Filter (Admin Only) */}
          {role === 'admin' && (
            <select
              value={agentId !== undefined ? agentId : ''}
              onChange={(e) => {
                const val = e.target.value;
                setAgentId(val === '' ? undefined : Number(val));
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 font-medium"
            >
              <option value="">All Leads (All Agents & Admins)</option>
              <option value="-1">Unassigned Leads</option>
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.full_name} ({ag.role === 'admin' ? 'Admin' : 'Agent'})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>Fetching records...</span>
          </div>
        ) : leads.length === 0 ? (
          <div className="py-20 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No leads found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No matching records for the current filters or no leads have been assigned yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Lead Name & Phone</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Property / Location</th>
                  <th className="py-3 px-4">Status</th>
                  {role === 'admin' && <th className="py-3 px-4">Assigned Team Member</th>}
                  <th className="py-3 px-4">Date Added</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => {
                  const badge = STATUS_BADGES[lead.status] || STATUS_BADGES['New'];
                  const isMeta = lead.source?.toLowerCase().includes('facebook') || lead.source?.toLowerCase().includes('instagram');

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/leads/${lead.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 flex items-center gap-1.5"
                        >
                          {lead.full_name}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          <span>{lead.phone}</span>
                          {lead.email && <span>• {lead.email}</span>}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                          {isMeta && <Share2 className="w-3 h-3 text-blue-600 shrink-0" />}
                          {lead.source}
                        </span>
                        {lead.meta_lead_id && role === 'admin' && (
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {lead.meta_lead_id}</p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700">
                        <p className="font-medium text-slate-800">{lead.property_type || 'Unspecified'}</p>
                        <p className="text-[11px] text-slate-400">{lead.preferred_location || 'Any location'}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                          {lead.status}
                        </span>
                      </td>

                      {role === 'admin' && (
                        <td className="py-3.5 px-4 text-slate-700">
                          {lead.assigned_agent ? (
                            <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {lead.assigned_agent.full_name}
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              Unassigned
                            </span>
                          )}
                        </td>
                      )}

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/leads/${lead.id}`}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => {
                              setEditingLead(lead);
                              setIsModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                            title="Edit Lead"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {role === 'admin' && (
                            <button
                              onClick={() => handleArchiveToggle(lead)}
                              className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                              title={lead.archived_at ? 'Restore Lead' : 'Archive Lead'}
                            >
                              {lead.archived_at ? (
                                <ArchiveRestore className="w-4 h-4 text-amber-600" />
                              ) : (
                                <Archive className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="p-4 bg-slate-50/50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing page {currentPage} of {pages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded font-medium disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= pages}
                onClick={() => setCurrentPage((p) => Math.min(pages, p + 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded font-medium disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <LeadModal
          lead={editingLead}
          agents={agents}
          onClose={() => {
            setIsModalOpen(false);
            setEditingLead(null);
          }}
          onSaved={handleLeadSaved}
        />
      )}
    </div>
  );
};
