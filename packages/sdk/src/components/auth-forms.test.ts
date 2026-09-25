import { describe, expect, it } from "@effect/vitest";
import { vi } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  retainSearchParams,
} from "@tanstack/react-router";

import { navigateTarget, resolveInitialAuthMethod } from "./auth-forms.js";

describe("navigateTarget", () => {
  it.each([
    "/api/auth/oauth2/authorize?sig=test&locale=en",
    "https://auth.example.com/oauth/authorize?state=test",
    "http://localhost/api/auth/oauth2/authorize?sig=test",
  ])("uses document navigation for %s", async (target) => {
    const history = createMemoryHistory({ initialEntries: ["/sign-in"] });
    const router = createRouter({
      routeTree: createRootRoute(),
      history,
      origin: "http://localhost",
    });
    const location = { href: "http://localhost/sign-in" };
    vi.stubGlobal("window", { location });
    try {
      await navigateTarget(target, router.navigate);
      expect(location.href).toBe(target);
      expect(history.location.href).toBe("/sign-in");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    ["/admin/assets?locale=en", "/en/admin/assets?locale=en"],
    ["/admin/assets?locale=fr#library", "/en/admin/assets?locale=fr#library"],
    ["/admin/assets", "/en/admin/assets?locale=en"],
  ])("preserves the return URL %s after sign-in", async (target, expected) => {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      origin: "http://localhost",
    });
    const root = createRootRoute({
      search: { middlewares: [retainSearchParams(["locale"])] },
    });
    const history = createMemoryHistory({
      initialEntries: [
        `/en/sign-in?redirect=${encodeURIComponent(target)}&locale=en`,
      ],
    });
    const router = createRouter({
      routeTree: root.addChildren([
        createRoute({ getParentRoute: () => root, path: "/sign-in" }),
        createRoute({ getParentRoute: () => root, path: "/admin/assets" }),
      ]),
      history,
      isServer: false,
      rewrite: {
        input: ({ url }) => {
          const result = new URL(url);
          result.pathname = result.pathname.replace(/^\/en(?=\/|$)/, "");
          return result;
        },
        output: ({ url }) => {
          const result = new URL(url);
          result.pathname = `/en${result.pathname}`;
          return result;
        },
      },
    });
    try {
      await router.load();

      await navigateTarget(target, router.navigate);

      expect(history.location.href).toBe(expected);
      expect(router.state.location.pathname).toBe("/admin/assets");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("resolveInitialAuthMethod", () => {
  it("restores password from the email login method", () => {
    expect(
      resolveInitialAuthMethod({
        requestedMethod: null,
        lastLoginMethod: "email",
        emailPassword: true,
        emailOtp: true,
      }),
    ).toBe("password");
  });

  it("restores the email OTP login method", () => {
    expect(
      resolveInitialAuthMethod({
        requestedMethod: null,
        lastLoginMethod: "email-otp",
        emailPassword: true,
        emailOtp: true,
      }),
    ).toBe("emailOtp");
  });

  it("prefers an available method requested in the URL", () => {
    expect(
      resolveInitialAuthMethod({
        requestedMethod: "emailOtp",
        lastLoginMethod: "email",
        emailPassword: true,
        emailOtp: true,
      }),
    ).toBe("emailOtp");
  });

  it("falls back when the remembered method is disabled", () => {
    expect(
      resolveInitialAuthMethod({
        requestedMethod: null,
        lastLoginMethod: "email",
        emailPassword: false,
        emailOtp: true,
      }),
    ).toBe("emailOtp");
  });
});
