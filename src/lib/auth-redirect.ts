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
  _projectAuthDomain: string | null | undefined,
  _projectRootDomain: string | null | undefined,
) => {
  return "/admin";
};
