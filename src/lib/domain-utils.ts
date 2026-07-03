export const parseCsv = (value: string | undefined) =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const normalizeAuthHost = (value: string | null | undefined) => {
  if (!value) return null;

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    const parsed = trimmed.includes("://")
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    return parsed.host.replace(/\.$/, "");
  } catch {
    return null;
  }
};

export const normalizeOAuthClientDomain = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.includes("://") || trimmed.includes("/")) {
    return null;
  }

  if (trimmed.includes("*")) return null;

  return normalizeAuthHost(trimmed);
};

export const normalizeOAuthClientDomains = (values: Iterable<string>) => {
  const domains = new Set<string>();

  for (const value of values) {
    const domain = normalizeOAuthClientDomain(value);
    if (domain) domains.add(domain);
  }

  return Array.from(domains);
};

export const cookieDomainForAuthDomainContext = ({
  isOriginDomain,
  sharedCookieDomain,
  fallbackCookieDomain,
}: {
  readonly isOriginDomain: boolean;
  readonly sharedCookieDomain?: string | undefined;
  readonly fallbackCookieDomain?: string | undefined;
}) =>
  isOriginDomain
    ? undefined
    : (sharedCookieDomain ?? fallbackCookieDomain);
