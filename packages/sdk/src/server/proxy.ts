const blockedRequestHeaders = [
  "accept-encoding",
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

const hostOnlyCookie = (cookie: string) =>
  cookie.replace(/;\s*domain=[^;]*/gi, "");

export interface ProxyAuthRequestOptions {
  cookieDomain?: string;
}

const normalizedCookieDomain = (domain: string) =>
  domain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");

const sharedCookieDomain = (
  request: Request,
  options?: ProxyAuthRequestOptions,
) => {
  if (!options?.cookieDomain) return null;

  const domain = normalizedCookieDomain(options.cookieDomain);
  const hostname = new URL(request.url).hostname.toLowerCase();

  if (!domain || (hostname !== domain && !hostname.endsWith(`.${domain}`))) {
    return null;
  }

  return domain;
};

const cookieForDomain = (cookie: string, domain: string | null) => {
  const hostOnly = hostOnlyCookie(cookie);
  if (!domain || hostOnly.startsWith("__Host-")) return hostOnly;

  return `${hostOnly}; Domain=${domain}`;
};

const proxyResponse = async (
  request: Request,
  response: Response,
  options?: ProxyAuthRequestOptions,
) => {
  const headers = new Headers(response.headers);
  const cookies = response.headers.getSetCookie();
  const cookieDomain = sharedCookieDomain(request, options);

  if (cookies.length > 0) {
    headers.delete("set-cookie");
    for (const cookie of cookies) {
      headers.append("set-cookie", cookieForDomain(cookie, cookieDomain));
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const forwardedUrl = (request: Request) => {
  return new URL(request.url);
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

export const proxyAuthRequest = async (
  request: Request,
  baseUrl: string | URL,
  options?: ProxyAuthRequestOptions,
) => {
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

  const response = await fetch(new Request(target, init), {
    redirect: "manual",
  });
  return proxyResponse(request, response, options);
};
