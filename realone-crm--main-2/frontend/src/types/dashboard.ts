export interface LeadCountByStatus {
  status: string;
  count: number;
}

export interface LeadCountBySource {
  source: string;
  count: number;
}

export interface AgentLeadCount {
  agent_id: number;
  agent_name: string;
  email: string;
  is_active: boolean;
  lead_count: number;
}

export interface RecentSyncEvent {
  id: number;
  external_lead_id?: string;
  event_type: string;
  status: string;
  created_at: string;
  error_message?: string;
}

export interface RecentActivityEvent {
  id: number;
  lead_id: number;
  type: string;
  description: string;
  created_at: string;
}

export interface AdminDashboardStats {
  role: 'admin';
  total_leads: number;
  new_leads: number;
  qualified_leads: number;
  negotiation_leads: number;
  won_leads: number;
  lost_leads: number;
  unassigned_leads: number;
  active_agent_count: number;
  pending_registrations: number;
  leads_by_source: LeadCountBySource[];
  leads_by_status: LeadCountByStatus[];
  leads_per_agent: AgentLeadCount[];
  recent_syncs: RecentSyncEvent[];
  recent_activities: RecentActivityEvent[];
}

export interface AgentDashboardStats {
  role: 'agent';
  total_leads: number;
  new_leads: number;
  qualified_leads: number;
  negotiation_leads: number;
  won_leads: number;
  lost_leads: number;
  leads_by_status: LeadCountByStatus[];
  leads_by_source: LeadCountBySource[];
  recent_leads: Array<{
    id: number;
    full_name: string;
    phone: string;
    status: string;
    source: string;
    property_type?: string;
    updated_at: string;
  }>;
  recent_activities: RecentActivityEvent[];
}

export type DashboardStats = AdminDashboardStats | AgentDashboardStats;
