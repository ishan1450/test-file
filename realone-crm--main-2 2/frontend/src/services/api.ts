const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '') + '/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;
  viaWorker: boolean;
  retryAfter: string | null;

  constructor(
    status: number,
    message: string,
    data?: any,
    viaWorker = false,
    retryAfter: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.viaWorker = viaWorker;
    this.retryAfter = retryAfter;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wake/check the backend before sending login credentials.
 * Render Free services can take a while to resume after inactivity.
 * Retries are limited to this safe GET health check, never the login POST.
 */
export async function waitForBackendReady(
  onStatus?: (message: string) => void,
  timeoutMs = 120_000,
): Promise<void> {
  const startedAt = Date.now();
  let attempt = 0;
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    attempt += 1;
    onStatus?.(attempt === 1 ? 'Connecting to the server…' : 'The server is waking up. Please wait…');

    try {
      const response = await fetch('/health', {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      });

      if (response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.status === 'healthy') return;
        lastError = new Error('Backend health endpoint did not return a healthy status.');
      } else if (response.status === 429) {
        const viaWorker = response.headers.get('x-crm-proxy') === 'cloudflare-worker';
        const origin = viaWorker ? 'backend/Render' : 'Cloudflare edge';
        throw new ApiError(429, `The ${origin} is temporarily rate-limiting requests. Please wait before trying again.`, null, viaWorker, response.headers.get('retry-after'));
      } else if ([502, 503, 504].includes(response.status)) {
        lastError = new Error(`Backend is starting (HTTP ${response.status}).`);
      } else {
        throw new ApiError(response.status, `Backend health check failed (HTTP ${response.status}).`, null, response.headers.get('x-crm-proxy') === 'cloudflare-worker');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) throw error;
      lastError = error;
    }

    onStatus?.('Waking up the server. This can take up to two minutes on the free plan…');
    await sleep(Math.min(5_000, Math.max(1_000, timeoutMs - (Date.now() - startedAt))));
  }

  throw new ApiError(
    0,
    'The server did not become available within two minutes. Please try again shortly.',
    { cause: lastError instanceof Error ? lastError.message : String(lastError ?? 'Unknown connection error') },
  );
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      cache: 'no-store',
    });
  } catch (error) {
    throw new ApiError(0, 'Could not connect to the CRM server. Check your connection and try again.', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  if (response.status === 401) {
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  }

  const contentType = response.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => '');
  }

  if (!response.ok) {
    const errorMsg = (data && data.detail) || (typeof data === 'string' && data) || `Request failed with status ${response.status}`;
    throw new ApiError(
      response.status,
      errorMsg,
      data,
      response.headers.get('x-crm-proxy') === 'cloudflare-worker',
      response.headers.get('retry-after'),
    );
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
