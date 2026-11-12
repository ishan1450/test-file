export interface MetaForm {
  id: string;
  name: string;
  status?: string;
  created_time?: string;
}

export interface MetaIntegration {
  id: number;
  page_id?: string | null;
  page_name?: string | null;
  instagram_account_id?: string | null;
  instagram_username?: string | null;
  is_connected: boolean;
  selected_forms: MetaForm[];
  field_mappings: Record<string, string>;
  webhook_verified: boolean;
  webhook_subscribed_at?: string | null;
  last_sync_at?: string | null;
  imported_count: number;
  failed_count: number;
  webhook_url: string;
  verify_token: string;
}

export interface MetaConnectionPayload {
  page_id: string;
  page_name?: string;
  access_token: string;
  instagram_account_id?: string;
  instagram_username?: string;
}

export interface MetaHistoricalImportPayload {
  form_ids?: string[];
  since_date?: string;
  until_date?: string;
}

export interface MetaImportResult {
  total_discovered: number;
  successfully_imported: number;
  duplicates_skipped: number;
  failed: number;
  completion_time_seconds: number;
  errors: string[];
}

export interface MetaSyncLog {
  id: number;
  external_lead_id?: string | null;
  event_type: string;
  status: 'success' | 'skipped_duplicate' | 'failed';
  attempt_count: number;
  error_message?: string | null;
  payload?: Record<string, any> | null;
  created_at: string;
  processed_at?: string | null;
}

export interface MetaSimulatePayload {
  full_name?: string;
  phone?: string;
  email?: string;
  property_type?: string;
  preferred_location?: string;
  max_budget?: number;
  platform?: string;
  campaign_name?: string;
  ad_name?: string;
}

export interface MetaSimulateResult {
  status: string;
  message: string;
  lead_id: number;
  full_name: string;
  phone: string;
  email?: string;
  source: string;
  campaign_name?: string;
  ad_name?: string;
  assigned_agent: {
    id?: number;
    full_name: string;
    email?: string;
  };
}
