import { describe, expect, it } from "@effect/vitest";
import { Atom, AtomRegistry } from "effect/reactivity";
import { vi } from "vitest";

import {
  AUTH_CLIENT_CHANGE_EVENT,
  notifyAuthChange,
  refreshOnAuthChange,
  reloadAfterImpersonation,
} from "./auth-atoms.js";

describe("auth atom revalidation", () => {
  it("reloads after impersonation without refreshing the previous user's guards", () => {
    const reload = vi.fn();
    const window = Object.assign(new EventTarget(), { location: { reload } });
    const onAuthChange = vi.fn();
    window.addEventListener(AUTH_CLIENT_CHANGE_EVENT, onAuthChange);
    vi.stubGlobal("window", window);
    try {
      reloadAfterImpersonation();

      expect(reload).toHaveBeenCalledExactlyOnceWith();
      expect(onAuthChange).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("refreshes mounted queries across registries and releases listeners", () => {
    const document = Object.assign(new EventTarget(), {
      visibilityState: "visible",
    });
    const window = Object.assign(new EventTarget(), { document });
    vi.stubGlobal("window", window);
    vi.stubGlobal("document", document);
    const removeListener = vi.spyOn(window, "removeEventListener");
    const addListener = vi.spyOn(window, "addEventListener");
    const root = AtomRegistry.make();
    const nested = AtomRegistry.make();
    let reads = 0;
    const session = Atom.make(() => ++reads).pipe(refreshOnAuthChange);
    const organization = Atom.make(() => ++reads).pipe(refreshOnAuthChange);
    try {
      root.mount(session);
      nested.mount(session);
      nested.mount(organization);
      const readAll = () => [
        root.get(session),
        nested.get(session),
        nested.get(organization),
      ];
      const initial = readAll();
      expect(
        addListener.mock.calls.filter(([name]) => name === "visibilitychange"),
      ).toHaveLength(2);

      window.dispatchEvent(new Event("visibilitychange"));
      const focused = readAll();
      focused.forEach((value, index) =>
        expect(value).toBeGreaterThan(initial[index]!),
      );

      notifyAuthChange();
      const changed = readAll();
      changed.forEach((value, index) =>
        expect(value).toBeGreaterThan(focused[index]!),
      );

      document.visibilityState = "hidden";
      window.dispatchEvent(new Event("visibilitychange"));
      expect(readAll()).toEqual(changed);
      window.dispatchEvent(new Event("pageshow"));
      expect(readAll()).toEqual(changed);

      document.visibilityState = "visible";
      window.dispatchEvent(new Event("visibilitychange"));
      const visible = readAll();
      visible.forEach((value, index) =>
        expect(value).toBeGreaterThan(changed[index]!),
      );

      root.dispose();
      nested.dispose();
      expect(
        removeListener.mock.calls.filter(
          ([name]) => name === "visibilitychange",
        ),
      ).toHaveLength(2);
      const previousReads = reads;
      window.dispatchEvent(new Event("visibilitychange"));
      expect(reads).toBe(previousReads);
    } finally {
      root.dispose();
      nested.dispose();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it("can read auth queries during SSR without browser globals", () => {
    const registry = AtomRegistry.make();
    try {
      expect(
        registry.get(Atom.make(() => "session").pipe(refreshOnAuthChange)),
      ).toBe("session");
    } finally {
      registry.dispose();
    }
  });
});
