const blockedRequestHeaders = [
  "connection",
  "content-length",
  "forwarded",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "cdn-loop",
] as const;

const proxyHeaders = (request: Request) => {
  const headers = new Headers(request.headers);

  for (const header of blockedRequestHeaders) headers.delete(header);
  for (const header of Array.from(headers.keys())) {
    if (header.startsWith("cf-") || header.startsWith("x-forwarded-")) {
      headers.delete(header);
    }
  }

  return headers;
};

export const proxyAuthRequest = (request: Request, baseUrl: string | URL) => {
  const target = new URL(request.url);
  const authUrl = new URL(baseUrl);
  const init: RequestInit = {
    headers: proxyHeaders(request),
    method: request.method,
  };

  target.protocol = authUrl.protocol;
  target.host = authUrl.host;
  target.username = authUrl.username;
  target.password = authUrl.password;

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  return fetch(new Request(target, init), { redirect: "manual" });
};
