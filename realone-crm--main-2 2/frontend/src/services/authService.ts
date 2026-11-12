import { api } from './api';
import { LoginPayload, RegisterPayload, TokenResponse, User } from '../types/auth';

export const authService = {
  async login(payload: LoginPayload): Promise<TokenResponse> {
    const data = await api.post<TokenResponse>('/auth/login', payload);
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify({
      id: data.user_id,
      full_name: data.full_name,
      email: data.email,
      role: data.role,
      approval_status: data.approval_status,
    }));
    return data;
  },

  async register(payload: RegisterPayload): Promise<User> {
    return api.post<User>('/auth/register', payload);
  },

  async reapply(payload: { email: string; full_name?: string; password?: string }): Promise<User> {
    return api.post<User>('/auth/reapply', payload);
  },

  async getMe(): Promise<User> {
    return api.get<User>('/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  },

  getCurrentUser(): Partial<User> | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  },
};
