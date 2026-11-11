
export interface Env {
  ASSETS: Fetcher;
  BACKEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API proxy
    if (url.pathname.startsWith("/api/")) {
      if (!env.BACKEND_URL) {
        return Response.json(
          { error: "BACKEND_URL is not configured" },
          { status: 500 }
        );
      }

      const backendBase = env.BACKEND_URL.replace(/\/+$/, "");
      const targetUrl = `${backendBase}${url.pathname}${url.search}`;

      const headers = new Headers(request.headers);

      // Let Cloudflare set the destination Host header.
      headers.delete("host");
      headers.delete("content-length");

      headers.set("x-forwarded-host", url.host);
      headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

      const proxyRequest = new Request(targetUrl, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method)
          ? undefined
          : request.body,
        redirect: "manual",
      });

      try {
        const response = await fetch(proxyRequest);

        const responseHeaders = new Headers(response.headers);
        responseHeaders.set("x-crm-proxy", "cloudflare-worker");

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch (error) {
        return Response.json(
          {
            error: "Backend connection failed",
            detail: String(error),
          },
          { status: 502 }
        );
      }
    }

    // Static assets
    if (url.pathname.includes(".")) {
      return env.ASSETS.fetch(request);
    }

    // SPA fallback
    return env.ASSETS.fetch(
      new Request(new URL("/index.html", request.url), request)
    );
  },
};
