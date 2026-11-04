import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  User,
  Share2,
  History,
  Tag,
  DollarSign,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Edit2,
  AlertCircle,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { leadService } from '../services/leadService';
import { userService } from '../services/userService';
import { LeadDetail, LeadStatus } from '../types/lead';
import { User as UserType } from '../types/auth';
import { LeadModal } from '../components/LeadModal';

const STATUS_OPTIONS: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won', 'Lost'];

export const LeadDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role, user: currentUser } = useAuth();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [agents, setAgents] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>(undefined);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchLead = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await leadService.getLead(Number(id));
      setLead(data);
      setSelectedAgentId(data.assigned_agent_id || undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch lead details');
    } finally {
      setIsLoading(false);
    }
  };

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

  useEffect(() => {
    fetchLead();
    fetchAgents();
  }, [id, role]);

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead || lead.status === newStatus) return;
    setIsUpdatingStatus(true);
    try {
      await leadService.updateLead(lead.id, { status: newStatus });
      fetchLead();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleManualReassign = async () => {
    if (!lead) return;
    try {
      await leadService.updateLead(lead.id, { assigned_agent_id: selectedAgentId });
      fetchLead();
      alert('Lead successfully reassigned by administrator.');
    } catch (err: any) {
      alert(err.message || 'Failed to reassign lead');
    }
  };

  const handleArchiveToggle = async () => {
    if (!lead) return;
    try {
      if (lead.archived_at) {
        await leadService.restoreLead(lead.id);
      } else {
        if (!window.confirm('Archive this lead?')) return;
        await leadService.archiveLead(lead.id);
      }
      fetchLead();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-xs font-medium">Loading lead profile...</span>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-xl text-center">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <p className="text-sm font-semibold">{error || 'Lead not found or unauthorized'}</p>
        <Link
          to="/leads"
          className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Leads
        </Link>
      </div>
    );
  }

  const isMetaLead = !!lead.meta_lead_id || lead.source?.toLowerCase().includes('facebook') || lead.source?.toLowerCase().includes('instagram');

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/leads"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Leads
        </Link>

        <div className="flex items-center gap-2">
          {role === 'admin' && (
            <button
              onClick={handleArchiveToggle}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              {lead.archived_at ? <ArchiveRestore className="w-3.5 h-3.5 text-amber-600" /> : <Archive className="w-3.5 h-3.5" />}
              <span>{lead.archived_at ? 'Restore Lead' : 'Archive'}</span>
            </button>
          )}

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit Details
          </button>
        </div>
      </div>

      {/* Main Info Header Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900">{lead.full_name}</h1>
              {lead.archived_at && (
                <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                  Archived
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <strong className="text-slate-800">{lead.phone}</strong>
              </span>
              {lead.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{lead.email}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Created {new Date(lead.created_at).toLocaleString()}</span>
              </span>
            </div>
          </div>

          {/* Current Status Pills */}
          <div className="flex flex-col items-start md:items-end">
            <span className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">
              Quick Status Progression
            </span>
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map((st) => (
                <button
                  key={st}
                  disabled={isUpdatingStatus}
                  onClick={() => handleStatusChange(st)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    lead.status === st
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Details, Meta info, Assignment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Property Preferences Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" /> Real Estate Profile
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Property Type</span>
                <span className="font-semibold text-slate-800 text-sm">{lead.property_type || 'Any Property'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Preferred Location</span>
                <span className="font-semibold text-slate-800 text-sm">{lead.preferred_location || 'Flexible'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Budget Range</span>
                <span className="font-semibold text-slate-800 text-sm">
                  {lead.min_budget || lead.max_budget
                    ? `$${(lead.min_budget || 0).toLocaleString()} - $${(lead.max_budget || 0).toLocaleString()}`
                    : 'Not specified'}
                </span>
              </div>
            </div>

            {lead.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-700 block mb-1">Notes</span>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg leading-relaxed whitespace-pre-wrap">
                  {lead.notes}
                </p>
              </div>
            )}
          </div>

          {/* Meta Lead Ads Metadata (if imported from Meta) */}
          {isMetaLead && (
            <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 p-5 rounded-xl border border-blue-200 shadow-sm">
              <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-blue-600" /> Meta Lead Ads Campaign Attribution
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-4">
                <div>
                  <span className="text-slate-500 block text-[11px]">Platform</span>
                  <span className="font-semibold text-slate-800">{lead.source}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Campaign Name</span>
                  <span className="font-semibold text-slate-800">{lead.meta_campaign_name || 'Direct Lead Ad'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Ad Creative</span>
                  <span className="font-semibold text-slate-800">{lead.meta_ad_name || 'Instant Form'}</span>
                </div>
                {role === 'admin' && (
                  <>
                    <div>
                      <span className="text-slate-500 block text-[11px]">External Meta Lead ID</span>
                      <span className="font-mono font-semibold text-slate-800 text-xs">{lead.meta_lead_id || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Meta Form ID</span>
                      <span className="font-mono text-slate-700">{lead.meta_form_id || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Page ID</span>
                      <span className="font-mono text-slate-700">{lead.meta_page_id || 'N/A'}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Form Custom Question Answers */}
              {lead.custom_fields && Object.keys(lead.custom_fields).length > 0 && (
                <div className="mt-3 pt-3 border-t border-blue-200/60">
                  <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block mb-2">
                    Form Questions & Answers
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(lead.custom_fields).map(([k, v]) => (
                      <div key={k} className="p-2 bg-white/80 rounded border border-blue-100 text-xs">
                        <span className="text-slate-500 text-[10px] uppercase font-semibold block">{k.replace(/_/g, ' ')}</span>
                        <span className="font-medium text-slate-900">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audit History Timeline */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" /> Complete Audit Trail & Activity History
            </h2>
            <div className="space-y-4">
              {lead.activities?.map((act) => (
                <div key={act.id} className="relative pl-6 pb-4 border-l-2 border-slate-200 last:border-transparent last:pb-0">
                  <div className="absolute -left-[7px] top-0 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{act.description}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(act.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Actor: <strong className="text-slate-700">{act.actor_name || 'System Automation'}</strong> • Action: <span className="font-mono text-[10px]">{act.activity_type}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar: Assignment & Ownership */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User className="w-4 h-4 text-blue-600" /> Assignment & Ownership
            </h2>

            <div className="p-3.5 bg-slate-50 rounded-lg text-xs mb-4">
              <span className="text-slate-400 block text-[11px] mb-0.5">Assigned Agent</span>
              {lead.assigned_agent ? (
                <div>
                  <p className="font-bold text-slate-900 text-sm">{lead.assigned_agent.full_name}</p>
                  <p className="text-slate-500">{lead.assigned_agent.email}</p>
                </div>
              ) : (
                <p className="text-amber-600 font-semibold">Unassigned</p>
              )}
            </div>

            {/* Admin Manual Reassignment */}
            {role === 'admin' ? (
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Reassign Lead (Admin Override)
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedAgentId || ''}
                    onChange={(e) => setSelectedAgentId(e.target.value ? Number(e.target.value) : undefined)}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="">Leave Unassigned</option>
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.full_name} ({ag.role === 'admin' ? 'Admin' : 'Agent'})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleManualReassign}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    Update
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Manual reassignment does not reset or advance automatic round-robin rotation.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                Only team administrators are authorized to reassign leads.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <LeadModal
          lead={lead}
          agents={agents}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={() => {
            setIsEditModalOpen(false);
            fetchLead();
          }}
        />
      )}
    </div>
  );
};
