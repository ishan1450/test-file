export interface Env {
  ASSETS: Fetcher;
  BACKEND_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. Worker API routes: proxy to backend if configured, never intercept with SPA HTML
    if (url.pathname.startsWith('/api/')) {
      if (env.BACKEND_URL) {
        const backendBase = env.BACKEND_URL.replace(/\/+$/, '');
        const targetUrl = new URL(url.pathname + url.search, backendBase);
        const headers = new Headers(request.headers);
        headers.set('Host', new URL(backendBase).host);
        // Bypass ngrok warning page when proxying through ngrok tunnels
        headers.set('ngrok-skip-browser-warning', 'true');

        const hasBody = !['GET', 'HEAD'].includes(request.method);

        return fetch(new Request(targetUrl.toString(), {
          method: request.method,
          headers: headers,
          body: hasBody ? request.body : undefined,
          redirect: 'follow',
        }));
      }

      // If no backend proxy is configured, return JSON 404 rather than serving HTML
      return new Response(
        JSON.stringify({
          error: 'Not Found',
          detail: `API endpoint '${url.pathname}' was not intercepted by SPA. Configure BACKEND_URL in Worker environment if proxying to an external backend.`,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Static assets with a file extension (e.g. .js, .css, .svg, .png)
    if (url.pathname.includes('.')) {
      return env.ASSETS.fetch(request);
    }

    // 3. SPA Fallback: for all client routes (/login, /dashboard, etc.), serve index.html with 200 OK
    const indexUrl = new URL('/index.html', request.url);
    return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
  },
};
