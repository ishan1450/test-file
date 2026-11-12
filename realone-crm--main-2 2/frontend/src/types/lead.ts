export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export type LeadSource =
  | 'Facebook Lead Ads'
  | 'Instagram Lead Ads'
  | 'Website'
  | 'Phone Call'
  | 'Referral'
  | 'Walk-in'
  | 'Other';

export interface LeadAgentSummary {
  id: number;
  full_name: string;
  email: string;
}

export interface LeadActivity {
  id: number;
  activity_type: string;
  description: string;
  actor_id?: number | null;
  actor_name?: string | null;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  created_at: string;
}

export interface Lead {
  id: number;
  full_name: string;
  phone: string;
  email?: string | null;
  source: string;
  meta_lead_id?: string | null;
  meta_page_id?: string | null;
  meta_form_id?: string | null;
  meta_campaign_id?: string | null;
  meta_campaign_name?: string | null;
  meta_ad_id?: string | null;
  meta_ad_name?: string | null;
  property_type?: string | null;
  preferred_location?: string | null;
  min_budget?: number | null;
  max_budget?: number | null;
  status: LeadStatus;
  notes?: string | null;
  custom_fields?: Record<string, any> | null;
  assigned_agent_id?: number | null;
  assigned_agent?: LeadAgentSummary | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

export interface LeadDetail extends Lead {
  activities: LeadActivity[];
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface LeadFilterParams {
  search?: string;
  status?: string;
  source?: string;
  property_type?: string;
  preferred_location?: string;
  agent_id?: number;
  archived_only?: boolean;
  include_archived?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

export interface LeadCreatePayload {
  full_name: string;
  phone: string;
  email?: string;
  source?: string;
  property_type?: string;
  preferred_location?: string;
  min_budget?: number;
  max_budget?: number;
  status?: LeadStatus;
  notes?: string;
  assigned_agent_id?: number;
  custom_fields?: Record<string, any>;
}

export interface LeadUpdatePayload {
  full_name?: string;
  phone?: string;
  email?: string;
  source?: string;
  property_type?: string;
  preferred_location?: string;
  min_budget?: number;
  max_budget?: number;
  status?: LeadStatus;
  notes?: string;
  assigned_agent_id?: number;
  custom_fields?: Record<string, any>;
}
