import { trustedOrigins } from "@/lib/trusted-origins";
import {
  authDomainContextForRequest,
  normalizeAuthHost,
} from "@/services/domains";

export type CorsOptions = {
  allowedOrigins?: "*" | readonly string[];
  allowedMethods?: readonly string[];
  credentials?: boolean;
};

const defaultCorsOptions = {
  allowedOrigins: trustedOrigins,
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
} satisfies Required<CorsOptions>;

export const publicCorsOptions = {
  allowedOrigins: "*",
  allowedMethods: ["GET", "OPTIONS"],
  credentials: false,
} satisfies Required<CorsOptions>;

const requestHeadersFallback = "Content-Type, Authorization";
const maxAge = "86400";
const varyRequestHeaders = "Access-Control-Request-Headers";

const resolveOptions = (options?: CorsOptions): Required<CorsOptions> => ({
  ...defaultCorsOptions,
  ...options,
});

const registeredDomainOrigin = async (request: Request, origin: string) => {
  const originHost = normalizeAuthHost(origin);
  if (!originHost) return undefined;

  const context = await authDomainContextForRequest(request);
  if (!context?.hosts.includes(originHost)) return undefined;

  try {
    return new URL(origin).origin;
  } catch {
    return undefined;
  }
};

const allowedOrigin = async (
  request: Request,
  allowedOrigins: Required<CorsOptions>["allowedOrigins"],
) => {
  if (allowedOrigins === "*") return "*";

  const origin = request.headers.get("origin");
  if (!origin) return undefined;
  if (allowedOrigins.includes(origin)) return origin;

  const domainOrigin = await registeredDomainOrigin(request, origin);
  if (domainOrigin) return domainOrigin;

  return undefined;
};

const corsHeaders = async (request: Request, options?: CorsOptions) => {
  const { allowedOrigins, allowedMethods, credentials } =
    resolveOptions(options);
  const origin = await allowedOrigin(request, allowedOrigins);
  const headers = new Headers({
    "Access-Control-Allow-Methods": allowedMethods.join(", "),
    "Access-Control-Allow-Headers":
      request.headers.get("access-control-request-headers") ??
      requestHeadersFallback,
    "Access-Control-Max-Age": maxAge,
    Vary: origin === "*" ? varyRequestHeaders : `Origin, ${varyRequestHeaders}`,
  });

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  if (credentials && origin && origin !== "*") {
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  return headers;
};

const mergeVary = (headers: Headers, value: string) => {
  const current =
    headers
      .get("Vary")
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? [];
  const seen = new Set(current.map((item) => item.toLowerCase()));
  const next = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && !seen.has(item.toLowerCase()));

  headers.set("Vary", [...current, ...next].join(", "));
};

const copyCorsHeaders = (target: Headers, source: Headers) => {
  source.forEach((value, key) => {
    if (key.toLowerCase() === "vary") {
      mergeVary(target, value);
      return;
    }

    target.set(key, value);
  });
};

export const applyCorsHeaders = async (
  request: Request,
  response: Response,
  options?: CorsOptions,
) => {
  const headers = new Headers(response.headers);
  copyCorsHeaders(headers, await corsHeaders(request, options));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const corsMiddleware =
  (
    handler: (request: Request) => Response | Promise<Response>,
    options?: CorsOptions,
  ) =>
  async (request: Request) => {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: await corsHeaders(request, options),
      });
    }

    const response = await handler(request);
    return await applyCorsHeaders(request, response, options);
  };
