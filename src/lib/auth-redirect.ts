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
  projectAuthDomain: string | null | undefined,
  projectRootDomain: string | null | undefined,
) => {
  if (typeof window === "undefined") return "/admin";

  const currentHost = normalizeAuthHost(window.location.host);
  const isProjectDomain = normalizeAuthHost(projectAuthDomain) === currentHost;

  if (!isProjectDomain) return "/admin";

  const rootDomain = normalizeAuthHost(projectRootDomain);
  if (!rootDomain) return "/admin";

  return `${window.location.protocol}//${rootDomain}`;
};
