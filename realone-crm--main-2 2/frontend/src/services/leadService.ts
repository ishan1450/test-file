import { api } from './api';
import {
  Lead,
  LeadDetail,
  LeadListResponse,
  LeadFilterParams,
  LeadCreatePayload,
  LeadUpdatePayload,
} from '../types/lead';

export const leadService = {
  async getLeads(params: LeadFilterParams = {}): Promise<LeadListResponse> {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.source) query.append('source', params.source);
    if (params.property_type) query.append('property_type', params.property_type);
    if (params.preferred_location) query.append('preferred_location', params.preferred_location);
    if (params.agent_id) query.append('agent_id', params.agent_id.toString());
    if (params.archived_only) query.append('archived_only', 'true');
    if (params.include_archived) query.append('include_archived', 'true');
    if (params.sort_by) query.append('sort_by', params.sort_by);
    if (params.sort_order) query.append('sort_order', params.sort_order);
    if (params.page) query.append('page', params.page.toString());
    if (params.size) query.append('size', params.size.toString());

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return api.get<LeadListResponse>(`/leads${queryString}`);
  },

  async getLead(id: number): Promise<LeadDetail> {
    return api.get<LeadDetail>(`/leads/${id}`);
  },

  async createLead(payload: LeadCreatePayload): Promise<Lead> {
    return api.post<Lead>('/leads', payload);
  },

  async updateLead(id: number, payload: LeadUpdatePayload): Promise<Lead> {
    return api.put<Lead>(`/leads/${id}`, payload);
  },

  async archiveLead(id: number): Promise<Lead> {
    return api.post<Lead>(`/leads/${id}/archive`);
  },

  async restoreLead(id: number): Promise<Lead> {
    return api.post<Lead>(`/leads/${id}/restore`);
  },
};
