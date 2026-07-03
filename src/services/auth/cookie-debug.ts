type CookieAttributes = {
  readonly name: string;
  readonly domain?: string | undefined;
  readonly path?: string | undefined;
  readonly sameSite?: string | undefined;
  readonly secure: boolean;
  readonly httpOnly: boolean;
  readonly maxAge?: string | undefined;
  readonly expires?: string | undefined;
};

export const isAuthCookieDebugEnabled = () =>
  process.env.AUTH_COOKIE_DEBUG === "true";

const readSetCookies = (headers: Headers) => {
  const setCookies = headers.getSetCookie();
  if (setCookies.length > 0) return setCookies;

  const setCookie = headers.get("set-cookie");
  return setCookie ? [setCookie] : [];
};

export const parseCookieAttributes = (cookie: string): CookieAttributes => {
  const [nameValue, ...attributes] = cookie
    .split(";")
    .map((part) => part.trim());
  const [name = ""] = nameValue.split("=");
  const parsed: Record<string, string | true> = {};

  for (const attribute of attributes) {
    const [rawKey = "", ...rawValue] = attribute.split("=");
    const key = rawKey.toLowerCase();
    parsed[key] = rawValue.length > 0 ? rawValue.join("=") : true;
  }

  return {
    name,
    domain: typeof parsed.domain === "string" ? parsed.domain : undefined,
    path: typeof parsed.path === "string" ? parsed.path : undefined,
    sameSite: typeof parsed.samesite === "string" ? parsed.samesite : undefined,
    secure: parsed.secure === true,
    httpOnly: parsed.httponly === true,
    maxAge:
      typeof parsed["max-age"] === "string" ? parsed["max-age"] : undefined,
    expires: typeof parsed.expires === "string" ? parsed.expires : undefined,
  };
};

export const logAuthCookieResponse = (request: Request, response: Response) => {
  if (!isAuthCookieDebugEnabled()) return;

  const setCookies = readSetCookies(response.headers).map(
    parseCookieAttributes,
  );
  console.info(
    "[auth-cookie-debug] response",
    JSON.stringify({
      method: request.method,
      path: new URL(request.url).pathname,
      status: response.status,
      location: response.headers.get("location"),
      setCookies,
    }),
  );
};
