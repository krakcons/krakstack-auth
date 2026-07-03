import { describe, expect, it } from "@effect/vitest";

import {
  cookieDomainForAuthDomainContext,
  normalizeAuthHost,
} from "@/lib/domain-utils";

describe("domain utils", () => {
  it("normalizes origin headers to hostnames", () => {
    expect(normalizeAuthHost("https://dev.kokobi.org")).toBe("dev.kokobi.org");
  });

  it("uses the exact origin host for proxied primary auth requests", () => {
    expect(
      cookieDomainForAuthDomainContext({
        domainHostname: "dev.kokobi.org",
        isOriginDomain: true,
        sharedCookieDomain: ".kokobi.org",
        fallbackCookieDomain: ".krakstack.net",
      }),
    ).toBe("dev.kokobi.org");
  });

  it("uses the shared domain for direct custom-domain requests", () => {
    expect(
      cookieDomainForAuthDomainContext({
        domainHostname: "dev.kokobi.org",
        isOriginDomain: false,
        sharedCookieDomain: ".kokobi.org",
        fallbackCookieDomain: ".kokobi.org",
      }),
    ).toBe(".kokobi.org");
  });
});
