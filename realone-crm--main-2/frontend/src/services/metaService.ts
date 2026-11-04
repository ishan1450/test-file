import { api } from './api';
import {
  MetaIntegration,
  MetaConnectionPayload,
  MetaForm,
  MetaHistoricalImportPayload,
  MetaImportResult,
  MetaSyncLog,
} from '../types/meta';

export const metaService = {
  async getStatus(): Promise<MetaIntegration> {
    return api.get<MetaIntegration>('/meta/status');
  },

  async connectMeta(payload: MetaConnectionPayload): Promise<MetaIntegration> {
    return api.post<MetaIntegration>('/meta/connect', payload);
  },

  async disconnectMeta(): Promise<{ message: string }> {
    return api.post<{ message: string }>('/meta/disconnect');
  },

  async getForms(): Promise<{ forms: MetaForm[]; warning?: string }> {
    return api.get<{ forms: MetaForm[]; warning?: string }>('/meta/forms');
  },

  async updateSelectedForms(forms: MetaForm[]): Promise<{ message: string; forms: MetaForm[] }> {
    return api.put<{ message: string; forms: MetaForm[] }>('/meta/forms', { forms });
  },

  async updateFieldMappings(mappings: Record<string, string>): Promise<{ message: string; field_mappings: Record<string, string> }> {
    return api.put<{ message: string; field_mappings: Record<string, string> }>('/meta/field-mappings', { mappings });
  },

  async importHistorical(payload: MetaHistoricalImportPayload): Promise<MetaImportResult> {
    return api.post<MetaImportResult>('/meta/import-historical', payload);
  },

  async syncNow(): Promise<MetaImportResult> {
    return api.post<MetaImportResult>('/meta/sync-now');
  },

  async getLogs(limit: number = 50): Promise<MetaSyncLog[]> {
    return api.get<MetaSyncLog[]>(`/meta/logs?limit=${limit}`);
  },

  async retryFailed(): Promise<{ retried: number; successfully_resolved: number }> {
    return api.post<{ retried: number; successfully_resolved: number }>('/meta/retry-failed');
  },

  async simulateLead(payload: any = {}): Promise<any> {
    return api.post<any>('/meta/simulate-lead', payload);
  },
};
