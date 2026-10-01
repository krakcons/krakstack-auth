import { describe, expect, it } from "@effect/vitest";
import { vi } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  retainSearchParams,
} from "@tanstack/react-router";

import {
  getRedirectTarget,
  getSocialRedirectTarget,
  getSocialSignInDestinations,
  navigateTarget,
  resolveInitialAuthMethod,
} from "./auth-forms.js";

describe("auth return destinations", () => {
  it.each([
    "https://",
    "http://[",
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:password@consumer.example.com/",
  ])("falls back safely for an invalid callback %s", (target) => {
    const search = `?callbackURL=${encodeURIComponent(target)}`;
    expect(getRedirectTarget(search)).toBe("/");
    expect(
      getSocialRedirectTarget(search, "/en/", "http://localhost:3004"),
    ).toBe("http://localhost:3004/en/");
  });

  it("defaults consumer forms to home, with an explicit auth-app admin override", () => {
    expect(getRedirectTarget("")).toBe("/");
    expect(getRedirectTarget("", "/admin")).toBe("/admin");
    expect(getRedirectTarget("?redirect=%2Fprojects", "/admin")).toBe(
      "/projects",
    );
  });

  it.each(["en", "fr"])(
    "returns Google sign-in to the consumer's %s home, including its port",
    (locale) => {
      expect(
        getSocialRedirectTarget("", `/${locale}/`, "http://localhost:3004"),
      ).toBe(`http://localhost:3004/${locale}/`);
    },
  );

  it.each(["callbackURL", "redirect", "redirectTo", "returnTo"])(
    "preserves the explicit %s destination, including search and hash",
    (param) => {
      const target = "/en/projects?view=all#latest";
      expect(
        getSocialRedirectTarget(
          `?${param}=${encodeURIComponent(target)}`,
          "/en/",
          "http://localhost:3004",
        ),
      ).toBe(`http://localhost:3004${target}`);
    },
  );

  it("preserves an explicit absolute callback", () => {
    const target = "https://consumer.example.com/fr/?view=all#latest";
    expect(
      getSocialRedirectTarget(
        `?callbackURL=${encodeURIComponent(target)}`,
        "/admin",
        "https://auth.example.com",
      ),
    ).toBe(target);
  });

  it("continues signed OAuth authorization on the browser origin without repeating prompt=login", () => {
    const target = getSocialRedirectTarget(
      "?client_id=test&prompt=login+consent&sig=test",
      "/en/",
      "https://auth.example.com",
    );
    const url = new URL(target);
    expect(url.origin).toBe("https://auth.example.com");
    expect(url.pathname).toBe("/api/auth/oauth2/authorize");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("sig")).toBe("test");
  });
});

describe("Google sign-in destinations at click time", () => {
  const makeRouter = (initialEntry: string, locale?: () => string) => {
    const root = createRootRoute();
    return createRouter({
      routeTree: root.addChildren([
        createRoute({ getParentRoute: () => root, path: "/" }),
        createRoute({ getParentRoute: () => root, path: "/sign-in" }),
        createRoute({ getParentRoute: () => root, path: "/admin" }),
      ]),
      history: createMemoryHistory({ initialEntries: [initialEntry] }),
      origin: "http://localhost:3004",
      rewrite: {
        input: ({ url }) => {
          const result = new URL(url);
          if (locale) {
            result.pathname = result.pathname.replace(/^\/(en|fr)(?=\/|$)/, "");
          }
          return result;
        },
        output: ({ url }) => {
          const result = new URL(url);
          if (locale) result.pathname = `/${locale()}${result.pathname}`;
          return result;
        },
      },
    });
  };

  it("supports unprefixed routes and preserves the actual error return URL", async () => {
    const search = "?projectId=test&returnTo=%2Fprojects&error=state_mismatch";
    const router = makeRouter(`/sign-in${search}`);
    await router.load();
    const result = getSocialSignInDestinations(
      router,
      undefined,
      `http://localhost:3004/sign-in${search}`,
    );
    expect(result.callbackURL).toBe("http://localhost:3004/projects");
    expect(result.errorCallbackURL).toBe(
      "http://localhost:3004/sign-in?projectId=test&returnTo=%2Fprojects",
    );
    const homeRouter = makeRouter("/sign-in");
    await homeRouter.load();
    expect(
      getSocialSignInDestinations(
        homeRouter,
        undefined,
        "http://localhost:3004/sign-in",
      ).callbackURL,
    ).toBe("http://localhost:3004/");
  });

  it("uses the current router locale after a change without recreating the router", async () => {
    let locale = "en";
    const router = makeRouter("/en/sign-in?projectId=test", () => locale);
    await router.load();
    expect(
      getSocialSignInDestinations(
        router,
        undefined,
        "http://localhost:3004/en/sign-in?projectId=test",
      ).callbackURL,
    ).toBe("http://localhost:3004/en/");
    locale = "fr";
    const result = getSocialSignInDestinations(
      router,
      undefined,
      "http://localhost:3004/fr/sign-in?projectId=test",
    );
    expect(result.callbackURL).toBe("http://localhost:3004/fr/");
    expect(result.errorCallbackURL).toBe(
      "http://localhost:3004/fr/sign-in?projectId=test",
    );
  });

  it("applies router rewrites to the auth application's explicit admin default", async () => {
    const router = makeRouter("/fr/sign-in", () => "fr");
    await router.load();
    expect(
      getSocialSignInDestinations(
        router,
        "/admin",
        "http://localhost:3004/fr/sign-in",
      ).callbackURL,
    ).toBe("http://localhost:3004/fr/admin");
  });

  it("preserves search and hash on a router-localized default destination", async () => {
    const router = makeRouter("/fr/sign-in", () => "fr");
    await router.load();
    expect(
      getSocialSignInDestinations(
        router,
        "/admin?view=all#latest",
        "http://localhost:3004/fr/sign-in",
      ).callbackURL,
    ).toBe("http://localhost:3004/fr/admin?view=all#latest");
  });

  it("recovers from malformed callbacks and defaults without breaking URL construction", async () => {
    const router = makeRouter("/sign-in?callbackURL=https%3A%2F%2F");
    await router.load();
    expect(
      getSocialSignInDestinations(
        router,
        "https://",
        "http://localhost:3004/sign-in?callbackURL=https%3A%2F%2F",
      ).callbackURL,
    ).toBe("http://localhost:3004/");
  });
});

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
