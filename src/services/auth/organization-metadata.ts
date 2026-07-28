export const mergeOrganizationMetadata = <T extends object>(
  current: unknown,
  incoming: T,
): T => {
  if (
    typeof current !== "object" ||
    current === null ||
    Array.isArray(current)
  ) {
    return incoming;
  }

  return { ...current, ...incoming };
};
