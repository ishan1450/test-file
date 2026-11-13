export interface Env {
  ASSETS: Fetcher;
  BACKEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const isApi = url.pathname.startsWith("/api/");
    const isHealth = url.pathname === "/health";

    if (isApi || isHealth) {
      if (!env.BACKEND_URL) {
        return Response.json(
          { error: "BACKEND_URL is not configured" },
          { status: 500 }
        );
      }

      const backendBase = env.BACKEND_URL.replace(/\/+$/, "");
      const targetUrl = new URL(
        url.pathname + url.search,
        backendBase
      );

      const headers = new Headers(request.headers);
      headers.delete("host");
      headers.delete("content-length");

      try {
        const response = await fetch(
          new Request(targetUrl.toString(), {
            method: request.method,
            headers,
            body: ["GET", "HEAD"].includes(request.method)
              ? undefined
              : request.body,
            redirect: "manual"
          })
        );

        console.log("Backend status:", response.status);
        console.log("Backend challenge:", response.headers.get("cf-mitigated"));
        console.log("Backend server:", response.headers.get("server"));
        console.log("Backend Ray ID:", response.headers.get("cf-ray"));


        const responseHeaders = new Headers(response.headers);

        responseHeaders.set("Cache-Control", "no-store");
        responseHeaders.set("X-CRM-Proxy", "cloudflare-worker");

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });

      } catch (error) {
        return Response.json(
          {
            error: "Backend connection failed",
            detail: String(error)
          },
          { status: 502 }
        );
      }
    }

    if (url.pathname.includes(".")) {
      return env.ASSETS.fetch(request);
    }

    const indexUrl = new URL("/index.html", request.url);

    return env.ASSETS.fetch(
      new Request(indexUrl.toString(), request)
    );
  }
};
