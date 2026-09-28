import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import {
  KrakstackAuthUnavailableError,
  resolveKrakstackAuthLocale,
  resolveProjectConfigState,
} from "./auth-provider.js";

const projectConfig = {
  projectKey: "test-project",
  name: null,
  logoUrl: null,
  authDomain: null,
  rootDomain: null,
  themeCss: null,
  authOptions: {
    emailPassword: true,
    emailOtp: false,
    google: false,
  },
};

describe("auth provider project configuration", () => {
  it("does not fail rendering while the configuration is loading", () => {
    expect(resolveProjectConfigState(AsyncResult.initial())).toEqual({
      status: "loading",
      error: null,
      projectConfig: null,
    });
  });

  it("exposes loaded project configuration", () => {
    expect(
      resolveProjectConfigState(AsyncResult.success(projectConfig)),
    ).toEqual({
      status: "ready",
      error: null,
      projectConfig,
    });
  });

  it("represents a first-load failure without throwing", () => {
    const state = resolveProjectConfigState(
      AsyncResult.fail(new Error("auth unavailable")),
    );

    expect(state.status).toBe("error");
    expect(state.projectConfig).toBeNull();
    expect(state.error).toBeInstanceOf(KrakstackAuthUnavailableError);
    expect(state.error?.status).toBe(503);
  });

  it("keeps previous configuration when a refresh fails", () => {
    const state = resolveProjectConfigState(
      AsyncResult.fail(new Error("auth unavailable"), {
        previousSuccess: Option.some(AsyncResult.success(projectConfig)),
      }),
    );

    expect(state.status).toBe("degraded");
    expect(state.projectConfig).toEqual(projectConfig);
    expect(state.error).toBeInstanceOf(KrakstackAuthUnavailableError);
  });

  it("treats a previous null configuration as degraded", () => {
    const state = resolveProjectConfigState(
      AsyncResult.fail(new Error("auth unavailable"), {
        previousSuccess: Option.some(AsyncResult.success(null)),
      }),
    );

    expect(state.status).toBe("degraded");
    expect(state.projectConfig).toBeNull();
  });
});

describe("auth provider locale", () => {
  it("normalizes French regional locales", () => {
    expect(resolveKrakstackAuthLocale("fr-CA")).toBe("fr");
  });

  it("uses English for other locales", () => {
    expect(resolveKrakstackAuthLocale("en-CA")).toBe("en");
  });
});
