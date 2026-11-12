import { api } from './api';
import { User } from '../types/auth';

export const userService = {
  async getUsers(role?: string, approval_status?: string): Promise<User[]> {
    const query = new URLSearchParams();
    if (role) query.append('role', role);
    if (approval_status) query.append('approval_status', approval_status);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return api.get<User[]>(`/users${queryString}`);
  },

  async getAgents(): Promise<User[]> {
    return api.get<User[]>('/users/agents');
  },

  async getPendingUsers(): Promise<User[]> {
    return api.get<User[]>('/users/pending');
  },

  async updateApproval(userId: number, action: 'approve' | 'reject'): Promise<User> {
    return api.put<User>(`/users/${userId}/approval`, { action });
  },

  async updateStatus(userId: number, is_active: boolean): Promise<User> {
    return api.put<User>(`/users/${userId}/status`, { is_active });
  },

  async updateRole(userId: number, role: 'admin' | 'agent'): Promise<User> {
    return api.put<User>(`/users/${userId}/role`, { role });
  },
};
