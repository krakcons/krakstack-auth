import { describe, expect, it } from "@effect/vitest";
import { defaultAuthEmailContent, resolveAuthEmailContent } from "./content";
import { AuthEmailKind } from "./schema";

describe("authentication email preview content", () => {
  it("exposes the code placeholder only for OTP defaults and resolves it for every purpose and language", () => {
    for (const locale of ["en", "fr"] as const) {
      for (const kind of AuthEmailKind.literals) {
        const input = { kind, locale, appName: "Example", code: "012345" };
        const defaults = defaultAuthEmailContent(input);
        const resolved = resolveAuthEmailContent(input);
        if (kind === "reset-password") {
          expect(defaults.preview).not.toContain("{code}");
          expect(resolved.preview).toBe(defaults.preview);
        } else {
          expect(defaults.preview).toContain("{code}");
          expect(resolved.preview).toBe(
            defaults.preview.replace("{code}", "012345"),
          );
          expect(resolved.preview).not.toContain("{code}");
        }
      }
    }
  });

  it("substitutes code only in OTP previews, preserving literal brand tokens and other content", () => {
    for (const kind of ["sign-in", "reset-password"] as const) {
      const content = resolveAuthEmailContent({
        kind,
        locale: "en",
        appName: "Brand {code} $&",
        code: "012345",
        settings: {
          templates: {
            [kind]: {
              en: {
                subject: "{code} {appName}",
                preview: "{code} {appName}",
                title: "{code}",
                body: "{code}",
                footer: "{code}",
                action: "{code}",
              },
            },
          },
        },
      });
      expect(content.preview).toBe(
        `${kind === "sign-in" ? "012345" : "{code}"} Brand {code} $&`,
      );
      expect(content.subject).toBe("{code} Brand {code} $&");
      for (const key of ["title", "body", "footer", "action"] as const)
        expect(content[key]).toBe("{code}");
    }
  });
});
