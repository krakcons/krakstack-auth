import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { m } from "@/paraglide/messages";
import { renderAuthEmail } from "./render";
import { AuthEmailKind, AuthEmailSettings } from "./schema";

describe("authentication email rendering", () => {
  it.effect(
    "uses defaults for legacy projects with no email settings and for empty settings",
    () =>
      Effect.gen(function* () {
        for (const locale of ["en", "fr"] satisfies Array<"en" | "fr">) {
          const input = {
            appName: "Existing project",
            locale,
            theme: { background: "#123456", foreground: "#abcdef" },
            action: { kind: "sign-in", otp: "012345" },
          } satisfies Parameters<typeof renderAuthEmail>[0];
          const legacy = yield* renderAuthEmail(input);
          expect(yield* renderAuthEmail({ ...input, settings: {} })).toEqual(
            legacy,
          );
          expect(
            yield* renderAuthEmail({
              ...input,
              settings: { appearance: {}, templates: {} },
            }),
          ).toEqual(legacy);
          expect(legacy.html).toContain("background-color:rgb(18,52,86)");
          expect(legacy.text).toContain("012345");
        }
      }),
  );

  it.effect(
    "renders independently aligned, proportional logos above the heading with bounded spacing",
    () =>
      Effect.gen(function* () {
        const email = yield* renderAuthEmail({
          appName: "Example",
          locale: "en",
          logo: "https://example.test/logo.svg",
          action: { kind: "sign-in", otp: "012345" },
          settings: {
            appearance: {
              alignment: "right",
              logoAlignment: "left",
              logoWidth: 120,
              logoSpacingTop: 12,
              logoSpacingBottom: 24,
            },
          },
        });
        expect(email.html).toMatch(
          /<td[^>]*align="left"[^>]*style="[^"]*padding-top:12px[^"]*padding-bottom:24px/,
        );
        expect(email.html).toMatch(/<img[^>]*width="120"/);
        expect(email.html).toContain("max-width:100%;height:auto");
        expect(email.html).toContain("text-align:right");
        expect(
          email.html.indexOf('src="https://example.test/logo.svg"'),
        ).toBeLessThan(email.html.indexOf("<h1"));
        const withoutLogo = yield* renderAuthEmail({
          appName: "Example",
          locale: "en",
          action: { kind: "sign-in", otp: "012345" },
        });
        expect(withoutLogo.html).not.toContain("<img");
      }),
  );

  it.effect(
    "keeps the real OTP and expiry in both formats for every OTP purpose",
    () =>
      Effect.gen(function* () {
        for (const kind of AuthEmailKind.literals) {
          if (kind === "reset-password") continue;
          const email = yield* renderAuthEmail({
            appName: "Example$&",
            locale: "fr",
            action: { kind, otp: "012345" },
            settings: {
              templates: {
                [kind]: {
                  fr: {
                    subject: "Code {appName}",
                    title: "Bonjour",
                    body: "Continuer",
                    footer: "Assistance",
                  },
                },
              },
            },
          });
          expect(email.subject).toBe("Code Example$&");
          for (const output of [email.html, email.text]) {
            expect(output).toContain("012345");
            expect(output).toContain(m.email_otp_expiry({}, { locale: "fr" }));
            expect(output).toContain("Continuer");
            expect(output).toContain("Assistance");
          }
        }
      }),
  );

  it.effect(
    "falls back per field in the recipient language, not another custom language",
    () =>
      Effect.gen(function* () {
        const settings = {
          templates: {
            "email-verification": {
              en: { title: "Custom English" },
              fr: { body: "   " },
            },
          },
        };
        const input = {
          appName: "Example",
          locale: "fr",
          action: { kind: "email-verification", otp: "987654" },
        } satisfies Parameters<typeof renderAuthEmail>[0];
        const defaults = yield* renderAuthEmail(input);
        const customized = yield* renderAuthEmail({ ...input, settings });
        expect(customized).toEqual(defaults);
        expect(customized.text).toContain(
          m.verify_email_title({}, { locale: "fr" }),
        );
      }),
  );

  it.effect(
    "keeps the server reset URL and includes edited content in plain text",
    () =>
      Effect.gen(function* () {
        const url =
          "https://auth.example.com/reset-password?token=server-token";
        const email = yield* renderAuthEmail({
          appName: "Example",
          locale: "en",
          action: { kind: "reset-password", url },
          settings: {
            templates: {
              "reset-password": {
                en: {
                  body: "Choose a new password",
                  action: "Continue safely",
                  footer: "Contact support",
                },
              },
            },
          },
        });
        expect(email.html).toContain(`href="${url}"`);
        expect(email.text).toContain(`Continue safely: ${url}`);
        expect(email.text).toContain("Contact support");
        expect(email.text).not.toContain(
          m.email_otp_expiry({}, { locale: "en" }),
        );
      }),
  );

  it.effect(
    "escapes content as text and removes header line breaks from brand names",
    () =>
      Effect.gen(function* () {
        const email = yield* renderAuthEmail({
          appName: "Example\r\nBcc: attacker@example.com",
          locale: "en",
          action: { kind: "sign-in", otp: "123456" },
          settings: {
            templates: {
              "sign-in": {
                en: {
                  title: '<img src=x onerror="alert(1)">',
                  body: "[link](javascript:alert(1))",
                  footer: "<script>alert(1)</script>",
                },
              },
            },
          },
        });
        expect(email.subject).not.toMatch(/[\r\n]/);
        expect(email.html).not.toContain("<script>");
        expect(email.html).not.toContain("<img src=x");
        expect(email.html).not.toContain('href="javascript:');
        expect(email.html).toContain("&lt;script&gt;");
      }),
  );

  it("rejects unsafe style values, oversized content, and header injection", () => {
    for (const settings of [
      { appearance: { background: "url(https://example.com)" } },
      { appearance: { logoWidth: 9999 } },
      { appearance: { logoAlignment: "bottom" } },
      { appearance: { alignment: "bottom" } },
      { appearance: { logoSpacingTop: -1 } },
      { appearance: { logoSpacingBottom: 97 } },
      { appearance: { logoSpacingTop: 1.5 } },
      { appearance: { padding: -1 } },
      {
        templates: {
          "sign-in": { en: { subject: "Hi\r\nBcc: x@example.com" } },
        },
      },
      { templates: { "sign-in": { en: { body: "x".repeat(4001) } } } },
    ])
      expect(Schema.is(AuthEmailSettings)(settings)).toBe(false);
  });

  it("accepts bounded logo settings and existing appearance settings", () => {
    for (const appearance of [
      {
        logoWidth: 32,
        logoAlignment: "left",
        logoSpacingTop: 0,
        logoSpacingBottom: 0,
      },
      {
        logoWidth: 400,
        logoAlignment: "right",
        logoSpacingTop: 96,
        logoSpacingBottom: 96,
      },
      { alignment: "center", logoWidth: 267 },
      { alignment: "right", logoAlignment: "left" },
    ]) {
      expect(Schema.is(AuthEmailSettings)({ appearance })).toBe(true);
    }
  });
});
