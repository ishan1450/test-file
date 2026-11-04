export type UserRole = 'admin' | 'agent';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  approval_status: ApprovalStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  approved_by?: number | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user_id: number;
  role: UserRole;
  approval_status: ApprovalStatus;
  full_name: string;
  email: string;
}
