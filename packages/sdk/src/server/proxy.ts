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

const parseUrl = (value: string | null) => {
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const forwardedUrl = (request: Request) => {
  return (
    parseUrl(request.headers.get("origin")) ??
    parseUrl(request.headers.get("referer")) ??
    new URL(request.url)
  );
};

const proxyHeaders = (request: Request) => {
  const headers = new Headers(request.headers);
  const url = forwardedUrl(request);

  for (const header of blockedRequestHeaders) headers.delete(header);
  for (const header of Array.from(headers.keys())) {
    if (header.startsWith("cf-") || header.startsWith("x-forwarded-")) {
      headers.delete(header);
    }
  }

  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

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
