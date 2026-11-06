import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { m } from "@/paraglide/messages";
import { renderAuthEmail } from "./render";
import {
  AuthEmailKind,
  AuthEmailSettings,
  type AuthEmailBlock,
} from "./schema";

describe("authentication email rendering", () => {
  it.effect(
    "hides only custom Footing text in both formats, retaining protected expiry, notices, actions, and outer Footer blocks",
    () =>
      Effect.gen(function* () {
        for (const locale of ["en", "fr"] as const) {
          for (const kind of AuthEmailKind.literals) {
            const settings = {
              appearance: { showFooting: false },
              templates: {
                [kind]: { [locale]: { footer: "Custom footing marker" } },
              },
              layout: {
                footer: {
                  blocks: [
                    {
                      id: "outer",
                      type: "text",
                      text: {
                        en: "Outer footer marker",
                        fr: "Outer footer marker",
                      },
                    },
                  ],
                },
              },
            } satisfies AuthEmailSettings;
            const action =
              kind === "reset-password"
                ? { kind, url: "https://example.com/reset?token=protected" }
                : { kind, otp: "012345" };
            const input = {
              appName: "Example",
              locale,
              action,
              notice: "Protected notice marker",
            };
            const hidden = yield* renderAuthEmail({ ...input, settings });
            const shown = yield* renderAuthEmail({
              ...input,
              settings: { ...settings, appearance: {} },
            });
            for (const output of [hidden.html, hidden.text]) {
              expect(output).not.toContain("Custom footing marker");
              expect(output).toContain("Outer footer marker");
              expect(output).toContain("Protected notice marker");
              expect(output).toContain(
                kind === "reset-password"
                  ? "https://example.com/reset?token=protected"
                  : "012345",
              );
              if (kind !== "reset-password")
                expect(output).toContain(m.email_otp_expiry({}, { locale }));
            }
            expect(shown.html).toContain("Custom footing marker");
            expect(shown.text).toContain("Custom footing marker");
          }
        }
      }),
  );
  it.effect(
    "renders independent text and link spacing, including zero, without changing defaults or plain text",
    () =>
      Effect.gen(function* () {
        for (const locale of ["en", "fr"] as const) {
          const blocks = [
            {
              id: "sender",
              type: "text",
              text: { en: "Sender marker", fr: "Sender marker" },
              style: { bold: true, lineHeight: 1 },
              spacingTop: 0,
              spacingBottom: 0,
            },
            {
              id: "address",
              type: "text",
              text: { en: "Address marker", fr: "Address marker" },
              spacingTop: 0,
              spacingBottom: 8,
            },
            {
              id: "link",
              type: "link",
              translations: {
                en: { label: "Support marker", url: "https://example.com" },
                fr: { label: "Support marker", url: "mailto:aide@example.com" },
              },
              spacingTop: 4,
              spacingBottom: 0,
            },
            {
              id: "default",
              type: "text",
              text: { en: "Default marker", fr: "Default marker" },
            },
          ] satisfies Array<AuthEmailBlock>;
          for (const name of ["header", "footer"] as const) {
            const input = {
              appName: "Example",
              locale,
              action: { kind: "sign-in", otp: "012345" } as const,
            };
            const email = yield* renderAuthEmail({
              ...input,
              settings: {
                typography: { body: { size: 18 } },
                layout: { [name]: { blocks } },
              },
            });
            const plain = yield* renderAuthEmail({
              ...input,
              settings: {
                typography: { body: { size: 18 } },
                layout: {
                  [name]: {
                    blocks: blocks.map((block) => ({
                      ...block,
                      spacingTop: 16,
                      spacingBottom: 16,
                    })),
                  },
                },
              },
            });
            expect(email.text).toBe(plain.text);
            for (const [marker, top, bottom] of [
              ["Sender marker", 0, 0],
              ["Address marker", 0, 8],
              ["Default marker", 16, 16],
            ] as const)
              expect(email.html).toMatch(
                new RegExp(
                  `<p(?=[^>]*margin-top:${top === 0 ? "0(?:px)?" : `${top}px`}[;"])(?=[^>]*margin-bottom:${bottom === 0 ? "0(?:px)?" : `${bottom}px`}[;"])[^>]*>${marker}</p>`,
                ),
              );
            expect(email.html).toMatch(
              /<p(?=[^>]*margin-top:4px)(?=[^>]*margin-bottom:0(?:px)?[;"])[^>]*><a[^>]*>Support marker<\/a><\/p>/,
            );
            expect(email.html).toMatch(
              /<p(?=[^>]*line-height:1[;"])[^>]*>Sender marker<\/p>/,
            );
            expect(email.html).toMatch(
              /<p(?=[^>]*line-height:1[;"])[^>]*><a(?=[^>]*line-height:1[;"])[^>]*>Support marker<\/a><\/p>/,
            );
            expect(email.html).toMatch(
              /<p(?=[^>]*line-height:1[;"])[^>]*>Default marker<\/p>/,
            );
            expect(email.text).toContain("012345");
            expect(email.text).toContain(m.email_otp_expiry({}, { locale }));
          }
        }
      }),
  );
  it.effect(
    "renders whole-element formatting for all email kinds and languages without altering protected actions or outer defaults",
    () =>
      Effect.gen(function* () {
        const formatting = {
          bold: true,
          italic: true,
          underline: true,
          strikethrough: true,
        };
        const normal = {
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
        };
        const settings = {
          typography: {
            heading: normal,
            body: formatting,
            help: formatting,
            code: formatting,
            button: formatting,
            projectName: normal,
          },
          layout: {
            header: {
              blocks: [
                {
                  id: "styled",
                  type: "text",
                  text: { en: "Styled outer", fr: "Styled outer" },
                  style: formatting,
                },
                {
                  id: "normal",
                  type: "text",
                  text: { en: "Unstyled outer", fr: "Unstyled outer" },
                },
              ],
            },
            footer: {
              blocks: [
                {
                  id: "link",
                  type: "link",
                  translations: {
                    en: { label: "Styled link", url: "https://example.com" },
                    fr: { label: "Styled link", url: "https://example.com/fr" },
                  },
                  style: { bold: true, italic: true, strikethrough: true },
                },
                {
                  id: "plain-link",
                  type: "link",
                  translations: {
                    en: { label: "Plain link", url: "mailto:help@example.com" },
                    fr: { label: "Plain link", url: "mailto:aide@example.com" },
                  },
                  style: normal,
                },
              ],
            },
          },
        } satisfies AuthEmailSettings;
        for (const locale of ["en", "fr"] as const) {
          for (const kind of AuthEmailKind.literals) {
            const url = "https://example.com/reset?token=protected";
            const action =
              kind === "reset-password"
                ? { kind, url }
                : { kind, otp: "012345" };
            const email = yield* renderAuthEmail({
              appName: "Brand marker",
              locale,
              action,
              settings,
              notice: "Notice marker",
            });
            const plain = yield* renderAuthEmail({
              appName: "Brand marker",
              locale,
              action,
              settings: { layout: settings.layout },
              notice: "Notice marker",
            });
            expect(email.text).toBe(plain.text);
            expect(email.html).toMatch(
              /<h1[^>]*font-weight:400[^>]*font-style:normal[^>]*text-decoration:none/,
            );
            for (const marker of [
              "Styled outer",
              "Styled link",
              "Notice marker",
              ...(kind === "reset-password" ? [] : ["012345"]),
            ])
              expect(email.html).toMatch(
                new RegExp(
                  `<(?:p|a)[^>]*font-weight:700[^>]*font-style:italic[^>]*text-decoration:underline line-through[^>]*>${marker}</(?:p|a)>`,
                ),
              );
            expect(email.html).toMatch(
              /<p(?![^>]*(?:font-weight|font-style|text-decoration))[^>]*>Unstyled outer<\/p>/,
            );
            expect(email.html).toMatch(
              /<a[^>]*font-weight:400[^>]*text-decoration:none[^>]*>Plain link<\/a>/,
            );
            expect(email.html).toMatch(
              /<p[^>]*font-weight:400[^>]*>Brand marker<\/p>/,
            );
            if (kind === "reset-password") {
              expect(email.html).toContain(`href="${url}"`);
              expect(email.html).toMatch(
                /<a[^>]*font-weight:700[^>]*text-decoration:underline line-through/,
              );
              expect(email.text).toContain(url);
            } else {
              expect(email.text).toContain("012345");
              expect(email.text).toContain(m.email_otp_expiry({}, { locale }));
            }
          }
        }
      }),
  );
  it.effect(
    "renders independent text colors while retaining legacy outer colors and protected actions",
    () =>
      Effect.gen(function* () {
        const settings = {
          appearance: {
            foreground: "#111111",
            mutedForeground: "#222222",
            primary: "#333333",
            primaryForeground: "#444444",
            muted: "#EEEEEE",
          },
          typography: {
            heading: { color: "#551100" },
            body: { color: "#662200" },
            code: { color: "#773300" },
            button: { color: "#884400" },
            help: { color: "#995500" },
            projectName: { color: "#AA6600" },
          },
          templates: {
            "sign-in": {
              en: { body: "Body color marker", footer: "Help color marker" },
              fr: { body: "Body color marker", footer: "Help color marker" },
            },
          },
          layout: {
            header: {
              blocks: [
                {
                  id: "normal",
                  type: "text",
                  text: {
                    en: "Legacy normal marker",
                    fr: "Legacy normal marker",
                  },
                },
                {
                  id: "muted",
                  type: "text",
                  tone: "muted",
                  text: {
                    en: "Legacy muted marker",
                    fr: "Legacy muted marker",
                  },
                },
                {
                  id: "custom",
                  type: "text",
                  tone: "muted",
                  style: { color: "#BB7700" },
                  text: {
                    en: "Custom outer marker",
                    fr: "Custom outer marker",
                  },
                },
              ],
            },
            footer: {
              blocks: [
                {
                  id: "legacy-link",
                  type: "link",
                  translations: {
                    en: {
                      label: "Legacy link marker",
                      url: "https://example.com/help",
                    },
                    fr: {
                      label: "Legacy link marker",
                      url: "https://example.com/fr",
                    },
                  },
                },
                {
                  id: "custom-link",
                  type: "link",
                  style: { color: "#CC8800" },
                  translations: {
                    en: {
                      label: "Custom link marker",
                      url: "mailto:help@example.com",
                    },
                    fr: {
                      label: "Custom link marker",
                      url: "mailto:aide@example.com",
                    },
                  },
                },
              ],
            },
          },
        } satisfies AuthEmailSettings;
        for (const locale of ["en", "fr"] as const) {
          const input = {
            appName: "Brand color marker",
            locale,
            settings,
            notice: "Notice color marker",
          };
          const email = yield* renderAuthEmail({
            ...input,
            action: { kind: "sign-in", otp: "012345" },
          });
          expect(email.html).toMatch(/<h1[^>]*color:#551100/i);
          for (const [color, text] of [
            ["#662200", "Body color marker"],
            ["#773300", "012345"],
            ["#995500", "Help color marker"],
            ["#995500", "Notice color marker"],
            ["#AA6600", "Brand color marker"],
            ["rgb\\(17,17,17\\)", "Legacy normal marker"],
            ["rgb\\(34,34,34\\)", "Legacy muted marker"],
            ["#BB7700", "Custom outer marker"],
          ])
            expect(email.html).toMatch(
              new RegExp(`<p[^>]*color:${color}[^>]*>${text}</p>`, "i"),
            );
          expect(email.html).toMatch(
            /<a[^>]*color:rgb\(51,51,51\)[^>]*>Legacy link marker<\/a>/i,
          );
          expect(email.html).toMatch(
            /<a[^>]*color:#CC8800[^>]*>Custom link marker<\/a>/i,
          );
          expect(email.text).toContain("012345");
          expect(email.text).toContain(m.email_otp_expiry({}, { locale }));
          const url = "https://example.com/reset?token=server-controlled";
          const reset = yield* renderAuthEmail({
            ...input,
            action: { kind: "reset-password", url },
          });
          expect(reset.html).toMatch(/<a[^>]*color:#884400/i);
          expect(reset.html).toContain(`href="${url}"`);
          expect(reset.text).toContain(url);
        }
      }),
  );
  it.effect(
    "aligns each body element independently without changing outer blocks or authentication actions",
    () =>
      Effect.gen(function* () {
        const settings = {
          typography: {
            font: "mono",
            heading: { alignment: "right" },
            body: { alignment: "center" },
            code: { alignment: "center" },
            button: { alignment: "right" },
          },
          templates: { "sign-in": { en: { body: "Body alignment marker" } } },
          layout: {
            header: {
              blocks: [
                {
                  id: "header",
                  type: "text",
                  text: { en: "Header alignment marker", fr: "En-tête" },
                },
              ],
            },
          },
        } satisfies AuthEmailSettings;
        const email = yield* renderAuthEmail({
          appName: "Example",
          locale: "en",
          action: { kind: "sign-in", otp: "012345" },
          settings,
        });
        expect(email.html).toMatch(/<h1[^>]*text-align:right/);
        expect(email.html).toMatch(
          /<p[^>]*text-align:center[^>]*>Body alignment marker<\/p>/,
        );
        expect(email.html).toMatch(/<p[^>]*text-align:center[^>]*>012345<\/p>/);
        expect(email.html).toMatch(
          /<p[^>]*text-align:left[^>]*>Header alignment marker<\/p>/,
        );
        const url = "https://example.com/reset?token=server-controlled";
        const reset = yield* renderAuthEmail({
          appName: "Example",
          locale: "en",
          action: { kind: "reset-password", url },
          settings,
        });
        expect(reset.html).toMatch(/<table[^>]*text-align:right/);
        expect(reset.text).toContain(url);
        expect(email.text).toContain("012345");
      }),
  );
  it.effect(
    "renders an intentional standalone divider but not a spacer-only section",
    () =>
      Effect.gen(function* () {
        const input = {
          appName: "Example",
          locale: "en",
          action: { kind: "sign-in", otp: "012345" },
        } satisfies Parameters<typeof renderAuthEmail>[0];
        const baseline = yield* renderAuthEmail(input);
        const spaced = yield* renderAuthEmail({
          ...input,
          settings: {
            layout: {
              footer: {
                blocks: [{ id: "space", type: "spacer", size: "large" }],
              },
            },
          },
        });
        expect(spaced).toEqual(baseline);
        const divided = yield* renderAuthEmail({
          ...input,
          settings: {
            layout: { footer: { blocks: [{ id: "line", type: "divider" }] } },
          },
        });
        expect(divided.html).toContain("<hr");
        expect(divided.text).toBe(baseline.text);
      }),
  );
  it.effect(
    "places the one logo first in its selected section and omits it when hidden",
    () =>
      Effect.gen(function* () {
        for (const logoPlacement of [
          "header",
          "card",
          "footer",
          "hidden",
        ] as const) {
          const email = yield* renderAuthEmail({
            appName: "Example",
            locale: "en",
            logo: "https://example.test/logo.svg",
            action: { kind: "sign-in", otp: "012345" },
            settings: {
              appearance: { logoPlacement },
              layout: {
                header: {
                  blocks: [
                    {
                      id: "header",
                      type: "text",
                      text: { en: "Header marker", fr: "En-tête" },
                    },
                  ],
                },
                footer: {
                  blocks: [
                    {
                      id: "footer",
                      type: "text",
                      text: { en: "Footer marker", fr: "Pied de page" },
                    },
                  ],
                },
              },
            },
          });
          const logo = email.html.indexOf(
            'src="https://example.test/logo.svg"',
          );
          const header = email.html.indexOf("Header marker");
          const card = email.html.indexOf("<h1");
          const footer = email.html.indexOf("Footer marker");
          expect(header).toBeLessThan(card);
          expect(card).toBeLessThan(footer);
          expect(email.html.match(/<img /g) ?? []).toHaveLength(
            logoPlacement === "hidden" ? 0 : 1,
          );
          if (logoPlacement === "header") expect(logo).toBeLessThan(header);
          if (logoPlacement === "card") {
            expect(logo).toBeGreaterThan(header);
            expect(logo).toBeLessThan(card);
          }
          if (logoPlacement === "footer") {
            expect(logo).toBeGreaterThan(card);
            expect(logo).toBeLessThan(footer);
          }
        }
      }),
  );

  it.effect(
    "renders localized ordered blocks in both formats for every email type without changing its authentication action",
    () =>
      Effect.gen(function* () {
        for (const locale of ["en", "fr"] as const) {
          for (const kind of AuthEmailKind.literals) {
            const url =
              "https://auth.example.com/reset-password?token=server-token";
            const email = yield* renderAuthEmail({
              appName: "Example",
              locale,
              action:
                kind === "reset-password"
                  ? { kind, url }
                  : { kind, otp: "012345" },
              settings: {
                layout: {
                  header: {
                    blocks: [
                      {
                        id: "header",
                        type: "text",
                        text: { en: "Welcome marker", fr: "Bienvenue repère" },
                      },
                    ],
                  },
                  footer: {
                    blocks: [
                      {
                        id: "sender",
                        type: "text",
                        text: {
                          en: "Sent by VolunteerConnector\n802, 5920 Macleod Tr SW",
                          fr: "Envoyé par VolunteerConnector\n802, 5920 Macleod Tr SW",
                        },
                      },
                      { id: "divider", type: "divider" },
                      { id: "space", type: "spacer", size: "large" },
                      {
                        id: "link",
                        type: "link",
                        translations: {
                          en: {
                            label: "Support",
                            url: "https://example.com/en/help",
                          },
                          fr: {
                            label: "Assistance",
                            url: "https://example.com/fr/aide",
                          },
                        },
                      },
                    ],
                  },
                },
              },
            });
            const intro =
              locale === "en" ? "Welcome marker" : "Bienvenue repère";
            const label = locale === "en" ? "Support" : "Assistance";
            const destination =
              locale === "en"
                ? "https://example.com/en/help"
                : "https://example.com/fr/aide";
            for (const output of [email.html, email.text]) {
              expect(output).toContain(intro);
              expect(output).toContain(destination);
              // The inbox preview can include the OTP before the visible header.
              expect(output.indexOf(intro)).toBeLessThan(
                output.lastIndexOf(kind === "reset-password" ? url : "012345"),
              );
              expect(output).toContain(
                kind === "reset-password"
                  ? url
                  : m.email_otp_expiry({}, { locale }),
              );
            }
            expect(email.text).toContain(`${label}: ${destination}`);
            expect(email.text).not.toContain(
              locale === "en" ? "Bienvenue repère" : "Welcome marker",
            );
          }
        }
      }),
  );

  it.effect(
    "hides only the automatic name and keeps logo accessibility, custom mentions, and security content",
    () =>
      Effect.gen(function* () {
        const email = yield* renderAuthEmail({
          appName: "UniqueBrand",
          locale: "en",
          logo: "https://example.test/logo.svg",
          action: { kind: "sign-in", otp: "012345" },
          settings: {
            appearance: { showProjectName: false },
            templates: {
              "sign-in": {
                en: {
                  subject: "Hello",
                  title: "Continue",
                  body: "Custom brand mention",
                  footer: "Help",
                },
              },
            },
          },
        });
        expect(email.text).not.toContain("UniqueBrand");
        expect(email.html).toContain('alt="UniqueBrand"');
        expect(email.html).not.toMatch(/>UniqueBrand</);
        expect(email.text).toContain("Custom brand mention");
        expect(email.text).toContain("012345");
      }),
  );

  it.effect(
    "applies typography to card roles and outer blocks with fallbacks",
    () =>
      Effect.gen(function* () {
        const settings = {
          typography: {
            font: "poppins",
            heading: { font: "serif", size: 36 },
            body: { size: 18 },
            code: { font: "mono", size: 24 },
            button: { size: 20 },
            help: { size: 14 },
            projectName: { size: 16 },
          },
          layout: {
            footer: {
              blocks: [
                {
                  id: "custom",
                  type: "text",
                  text: { en: "Custom type", fr: "Typographie" },
                  style: { font: "sans", size: 12 },
                },
              ],
            },
          },
        } satisfies AuthEmailSettings;
        const email = yield* renderAuthEmail({
          appName: "Example",
          locale: "en",
          action: { kind: "sign-in", otp: "012345" },
          settings,
        });
        expect(email.html).toMatch(
          /<h1[^>]*font-size:36px[^>]*font-family:Georgia/,
        );
        expect(email.html).toMatch(/<p[^>]*font-size:24px[^>]*>012345<\/p>/);
        expect(email.html).toMatch(
          /<p[^>]*font-size:12px[^>]*font-family:Arial[^>]*>Custom type<\/p>/,
        );
        expect(email.html).toContain(
          "fonts.googleapis.com/css2?family=Poppins",
        );
        const reset = yield* renderAuthEmail({
          appName: "Example",
          locale: "en",
          action: { kind: "reset-password", url: "https://example.com/reset" },
          settings,
        });
        expect(reset.html).toMatch(/<a[^>]*font-size:20px/);
      }),
  );

  it.effect(
    "escapes block text and previews incomplete translations without fallback or empty section gaps",
    () =>
      Effect.gen(function* () {
        const input = {
          appName: "Example",
          locale: "fr",
          action: { kind: "sign-in", otp: "012345" },
        } satisfies Parameters<typeof renderAuthEmail>[0];
        const baseline = yield* renderAuthEmail(input);
        const empty = yield* renderAuthEmail({
          ...input,
          settings: {
            layout: {
              header: {
                gap: "large",
                blocks: [
                  {
                    id: "empty",
                    type: "text",
                    text: { en: "English only", fr: "" },
                  },
                  { id: "spacer", type: "spacer", size: "large" },
                ],
              },
            },
          },
        });
        expect(empty).toEqual(baseline);
        const escaped = yield* renderAuthEmail({
          ...input,
          settings: {
            layout: {
              footer: {
                blocks: [
                  {
                    id: "unsafe",
                    type: "text",
                    text: {
                      en: "",
                      fr: "<script>alert(1)</script>\n{appName}",
                    },
                  },
                ],
              },
            },
          },
        });
        expect(escaped.html).toContain("&lt;script&gt;");
        expect(escaped.html).not.toContain("<script>");
        expect(escaped.text).toContain("{appName}");
      }),
  );

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
          expect(legacy.html).toContain(
            `data-skip-in-text="true">${m.auth_email_otp_preview({ code: "012345" }, { locale })}`,
          );
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
          expect(email.html).toContain(
            `data-skip-in-text="true">${m.auth_email_otp_preview({ code: "012345" }, { locale: "fr" })}`,
          );
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
