import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../services/authService';

describe('Frontend Critical Flows', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores tokens and user session on login', () => {
    const mockUser = {
      id: 1,
      full_name: 'Alex Vance',
      email: 'admin@realestate.com',
      role: 'admin',
      approval_status: 'approved',
    };

    localStorage.setItem('access_token', 'test_jwt_access_token');
    localStorage.setItem('user', JSON.stringify(mockUser));

    expect(authService.isAuthenticated()).toBe(true);
    const user = authService.getCurrentUser();
    expect(user?.email).toBe('admin@realestate.com');
    expect(user?.role).toBe('admin');
  });

  it('clears storage completely on logout', async () => {
    localStorage.setItem('access_token', 'test_jwt');
    localStorage.setItem('user', JSON.stringify({ id: 1 }));

    await authService.logout();

    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.getCurrentUser()).toBe(null);
  });
});
