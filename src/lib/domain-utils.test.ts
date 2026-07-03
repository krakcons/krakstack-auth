import { describe, expect, it } from "@effect/vitest";

import {
  cookieDomainForAuthDomainContext,
  normalizeAuthHost,
} from "@/lib/domain-utils";

describe("domain utils", () => {
  it("normalizes origin headers to hostnames", () => {
    expect(normalizeAuthHost("https://dev.kokobi.org")).toBe("dev.kokobi.org");
  });

  it("omits cookie domain for proxied primary auth requests", () => {
    expect(
      cookieDomainForAuthDomainContext({
        isOriginDomain: true,
        sharedCookieDomain: ".kokobi.org",
        fallbackCookieDomain: ".krakstack.net",
      }),
    ).toBeUndefined();
  });

  it("uses the shared domain for direct custom-domain requests", () => {
    expect(
      cookieDomainForAuthDomainContext({
        isOriginDomain: false,
        sharedCookieDomain: ".kokobi.org",
        fallbackCookieDomain: ".kokobi.org",
      }),
    ).toBe(".kokobi.org");
  });
});
