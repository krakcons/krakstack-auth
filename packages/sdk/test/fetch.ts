// Preserve runtime fetch extensions (such as Bun's preconnect) on test doubles.
export const mockFetch = (
  handler: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>,
): typeof fetch => Object.assign(handler, globalThis.fetch);
