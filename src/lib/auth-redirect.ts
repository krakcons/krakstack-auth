import { getDomain } from "tldts";

import { normalizeAuthHost } from "@/lib/domain-utils";

export const getAuthRedirectParam = (searchString: string) => {
  const search = new URLSearchParams(searchString);
  return (
    search.get("callbackURL") ??
    search.get("redirect") ??
    search.get("redirectTo") ??
    search.get("returnTo")
  );
};

export const getDefaultAuthRedirectTarget = (
  projectDomains: ReadonlyArray<string> | undefined,
) => {
  if (typeof window === "undefined") return "/admin";

  const currentHost = normalizeAuthHost(window.location.host);
  const isProjectDomain = projectDomains?.some(
    (domain) => normalizeAuthHost(domain) === currentHost,
  );

  if (!isProjectDomain) return "/admin";

  const rootDomain = getDomain(window.location.hostname);
  if (!rootDomain) return "/admin";

  return `${window.location.protocol}//${rootDomain}`;
};
