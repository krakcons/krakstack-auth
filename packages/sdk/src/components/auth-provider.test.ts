import { describe, expect, it } from "@effect/vitest";

import { listenForSessionRevalidation } from "./auth-provider.js";

describe("listenForSessionRevalidation", () => {
  it("revalidates only on back-forward cache restoration", () => {
    const target = new EventTarget();
    let revalidations = 0;
    const stop = listenForSessionRevalidation(target, () => {
      revalidations += 1;
    });
    const restoredPage = new Event("pageshow");
    Object.defineProperty(restoredPage, "persisted", { value: true });

    target.dispatchEvent(new Event("focus"));
    target.dispatchEvent(new Event("pageshow"));
    expect(revalidations).toBe(0);

    target.dispatchEvent(restoredPage);

    expect(revalidations).toBe(1);

    stop();
    target.dispatchEvent(restoredPage);

    expect(revalidations).toBe(1);
  });
});
