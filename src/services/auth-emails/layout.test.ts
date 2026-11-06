import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
  AuthEmailDraftSettings,
  AuthEmailLinkDestination,
  AuthEmailSettings,
  AuthEmailTestPayload,
  emailLineHeightOptions,
  emailSizeOptions,
} from "./schema";
import {
  resetEmailAppearance,
  resetEmailLayout,
  resetEmailTypography,
} from "./layout";
import {
  emailTextStyle,
  resolveEmailTextStyle,
  resolveEmailRoleColor,
  resolveEmailTextFormatting,
  emailRoleIsBold,
} from "./typography";

const settings = {
  appearance: {
    logoPlacement: "footer",
    showProjectName: false,
    logoWidth: 120,
  },
  typography: {
    font: "poppins",
    body: { size: 18, color: "#112233" },
    help: { font: "serif", size: 14 },
    heading: { color: "#223344", alignment: "right" },
  },
  layout: {
    header: {
      gap: "large",
      blocks: [
        {
          id: "intro",
          type: "text",
          text: { en: "Hello", fr: "Bonjour" },
          alignment: "center",
          tone: "muted",
          style: { font: "mono", size: 20, color: "#334455" },
        },
      ],
    },
    footer: {
      gap: "small",
      blocks: [
        {
          id: "contact",
          type: "link",
          translations: {
            en: { label: "Support", url: "mailto:help@example.com" },
            fr: { label: "Aide", url: "https://example.com/fr/aide" },
          },
          style: { size: 12, color: "#445566" },
        },
        { id: "gap", type: "spacer", size: "large" },
        { id: "line", type: "divider" },
      ],
    },
  },
  templates: { "sign-in": { en: { title: "Keep this" } } },
} satisfies AuthEmailSettings;

describe("email layout boundaries", () => {
  it("bounds block line height and applies it independently of font size", () => {
    for (const block of [
      settings.layout.header.blocks[0],
      settings.layout.footer.blocks[0],
    ]) {
      for (const lineHeight of emailLineHeightOptions) {
        const input = {
          layout: { footer: { blocks: [{ ...block, style: { lineHeight } }] } },
        };
        const json = Schema.fromJsonString(AuthEmailSettings);
        expect(Schema.decodeSync(json)(Schema.encodeSync(json)(input))).toEqual(
          input,
        );
        expect(
          resetEmailTypography(input).layout?.footer?.blocks[0],
        ).not.toHaveProperty("style");
      }
      for (const lineHeight of [0, 0.5, 3, "1", "normal", null, Number.NaN])
        expect(
          Schema.is(AuthEmailSettings)({
            layout: {
              header: { blocks: [{ ...block, style: { lineHeight } }] },
            },
          }),
        ).toBe(false);
    }
    expect(emailTextStyle(undefined, "body", { lineHeight: 1 })).toEqual({
      lineHeight: 1,
    });
    expect(
      emailTextStyle({ body: { size: 18 } }, "body", {
        size: 12,
        lineHeight: 1.25,
      }),
    ).toMatchObject({ fontSize: 12, lineHeight: 1.25 });
  });
  it("restores the default layout without changing saved text or translations", () => {
    const input = {
      ...settings,
      templates: {
        "sign-in": {
          en: {
            subject: "Subject",
            preview: "Preview {code}",
            title: "Hello",
            body: "Message",
          },
          fr: { title: "Bonjour" },
        },
      },
    };
    const reset = resetEmailLayout(input);
    expect(reset).toEqual({ templates: input.templates });
    const json = Schema.fromJsonString(AuthEmailSettings);
    expect(Schema.decodeSync(json)(Schema.encodeSync(json)(reset))).toEqual(
      reset,
    );
    expect(resetEmailLayout({})).toEqual({});
    expect(input.layout.header.blocks).toHaveLength(1);
    expect(input.appearance.logoWidth).toBe(120);
  });
  it("bounds independent text/link spacing and preserves it through JSON and typography resets only", () => {
    for (const block of [
      settings.layout.header.blocks[0],
      settings.layout.footer.blocks[0],
    ]) {
      for (const spacingTop of [0, 8, 96]) {
        const input = {
          layout: {
            footer: { blocks: [{ ...block, spacingTop, spacingBottom: 0 }] },
          },
        };
        const json = Schema.fromJsonString(AuthEmailSettings);
        expect(Schema.decodeSync(json)(Schema.encodeSync(json)(input))).toEqual(
          input,
        );
        expect(
          resetEmailTypography(input).layout?.footer?.blocks[0],
        ).toMatchObject({ spacingTop, spacingBottom: 0 });
        expect(
          resetEmailAppearance(input).layout?.footer?.blocks[0],
        ).not.toHaveProperty("spacingTop");
        expect(
          resetEmailAppearance(input).layout?.footer?.blocks[0],
        ).not.toHaveProperty("spacingBottom");
      }
      for (const key of ["spacingTop", "spacingBottom"]) {
        for (const value of [-1, 97, 1.5, "16", null, Number.NaN])
          expect(
            Schema.is(AuthEmailSettings)({
              layout: { header: { blocks: [{ ...block, [key]: value }] } },
            }),
          ).toBe(false);
      }
    }
  });
  it("validates boolean formatting for every role and outer text/link, preserving false through JSON and resets", () => {
    const json = Schema.fromJsonString(AuthEmailSettings);
    for (const key of [
      "bold",
      "italic",
      "underline",
      "strikethrough",
    ] as const) {
      for (const value of [true, false]) {
        const input = {
          typography: Object.fromEntries(
            Object.keys(emailSizeOptions).map((role) => [
              role,
              { [key]: value },
            ]),
          ),
          layout: {
            header: {
              blocks: [
                {
                  ...settings.layout.header.blocks[0],
                  style: { [key]: value },
                },
              ],
            },
            footer: {
              blocks: [
                {
                  ...settings.layout.footer.blocks[0],
                  style: { [key]: value },
                },
              ],
            },
          },
        };
        expect(Schema.decodeSync(json)(Schema.encodeSync(json)(input))).toEqual(
          input,
        );
        expect(resetEmailTypography(input).typography).toBeUndefined();
        expect(
          resetEmailTypography(input).layout?.header?.blocks[0],
        ).not.toHaveProperty("style");
        expect(
          resetEmailAppearance(input).layout?.footer?.blocks[0],
        ).not.toHaveProperty("style");
      }
      for (const value of ["bold", "false", 1, null]) {
        for (const role of Object.keys(emailSizeOptions))
          expect(
            Schema.is(AuthEmailSettings)({
              typography: { [role]: { [key]: value } },
            }),
          ).toBe(false);
        for (const block of [
          settings.layout.header.blocks[0],
          settings.layout.footer.blocks[0],
        ])
          expect(
            Schema.is(AuthEmailSettings)({
              layout: {
                header: { blocks: [{ ...block, style: { [key]: value } }] },
              },
            }),
          ).toBe(false);
      }
    }
  });
  it("resolves effective formatting without changing legacy rendering and combines decorations", () => {
    expect(
      resolveEmailTextFormatting(undefined, {
        bold: emailRoleIsBold("heading"),
      }),
    ).toEqual({
      bold: true,
      italic: false,
      underline: false,
      strikethrough: false,
    });
    expect(
      resolveEmailTextFormatting(
        { bold: false, underline: false },
        { bold: true, underline: true },
      ),
    ).toEqual({
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
    });
    expect(emailTextStyle(undefined, "heading")).toEqual({});
    expect(
      emailTextStyle(
        {
          body: {
            bold: true,
            italic: true,
            underline: true,
            strikethrough: true,
          },
        },
        "body",
      ),
    ).toEqual({
      fontWeight: 700,
      fontStyle: "italic",
      textDecoration: "underline line-through",
    });
    expect(
      emailTextStyle(
        {
          body: {
            bold: true,
            italic: true,
            underline: true,
            strikethrough: true,
          },
        },
        "body",
        { bold: false, italic: false, underline: false, strikethrough: false },
      ),
    ).toEqual({ fontWeight: 400, fontStyle: "normal", textDecoration: "none" });
  });
  it("accepts only six-digit HEX text colors for each role and outer text/link block", () => {
    for (const role of Object.keys(emailSizeOptions)) {
      expect(
        Schema.is(AuthEmailSettings)({
          typography: { [role]: { color: "#12aBcF" } },
        }),
      ).toBe(true);
      for (const color of [
        "red",
        "#123",
        "#12345678",
        "#12345G",
        "#123456;color:red",
        "var(--color)",
      ]) {
        expect(
          Schema.is(AuthEmailSettings)({ typography: { [role]: { color } } }),
        ).toBe(false);
        for (const block of [
          settings.layout.header.blocks[0],
          settings.layout.footer.blocks[0],
        ]) {
          expect(
            Schema.is(AuthEmailSettings)({
              layout: { header: { blocks: [{ ...block, style: { color } }] } },
            }),
          ).toBe(false);
        }
      }
    }
    expect(
      Schema.is(AuthEmailSettings)({
        layout: {
          header: {
            blocks: [
              {
                ...settings.layout.header.blocks[0],
                style: { color: "#12aBcF" },
              },
              {
                ...settings.layout.footer.blocks[0],
                style: { color: "#aBc123" },
              },
            ],
          },
        },
      }),
    ).toBe(true);
  });

  it("resolves local text colors over retained legacy colors without materializing overrides", () => {
    const legacy = {
      appearance: {
        foreground: "#112233",
        mutedForeground: "#445566",
        primaryForeground: "#FFFFFF",
      },
    };
    expect(resolveEmailRoleColor({}, "heading")).toBe("#0A1F44");
    expect(resolveEmailRoleColor(legacy, "heading")).toBe("#112233");
    expect(resolveEmailRoleColor(legacy, "help")).toBe("#112233");
    expect(resolveEmailRoleColor(legacy, "projectName")).toBe("#445566");
    expect(resolveEmailRoleColor(legacy, "button")).toBe("#FFFFFF");
    const typography = { body: { color: "#778899" } };
    expect(resolveEmailRoleColor({ ...legacy, typography }, "body")).toBe(
      "#778899",
    );
    expect(emailTextStyle(typography, "body")).toEqual({ color: "#778899" });
    expect(emailTextStyle(typography, "body", { color: "#AABBCC" })).toEqual({
      color: "#AABBCC",
    });
    expect(legacy).not.toHaveProperty("typography");
  });
  it("validates per-element alignment without changing legacy shared font settings", () => {
    const aligned = {
      typography: {
        font: "mono",
        heading: { alignment: "right" },
        body: { alignment: "center" },
        button: { alignment: "left" },
      },
    };
    expect(Schema.is(AuthEmailSettings)(aligned)).toBe(true);
    expect(
      Schema.is(AuthEmailSettings)({
        typography: { body: { alignment: "justify" } },
      }),
    ).toBe(false);
    expect(
      Schema.is(AuthEmailSettings)({
        typography: { button: { alignment: "bottom" } },
      }),
    ).toBe(false);
  });
  it("resolves the displayed font and size without materializing settings", () => {
    expect(resolveEmailTextStyle(undefined, "heading")).toEqual({
      font: "sans",
      size: 32,
    });
    expect(resolveEmailTextStyle(undefined, "body")).toEqual({
      font: "sans",
      size: 16,
    });
    expect(resolveEmailTextStyle(undefined, "code")).toEqual({
      font: "sans",
      size: 30,
    });
    expect(resolveEmailTextStyle(undefined, "button")).toEqual({
      font: "sans",
      size: 16,
    });
    expect(resolveEmailTextStyle(undefined, "help")).toEqual({
      font: "sans",
      size: 14,
    });
    expect(resolveEmailTextStyle(undefined, "projectName")).toEqual({
      font: "sans",
      size: 12,
    });
    expect(resolveEmailTextStyle(settings.typography, "body")).toEqual({
      font: "poppins",
      size: 18,
    });
    expect(
      resolveEmailTextStyle(settings.typography, "body", { size: 12 }),
    ).toEqual({ font: "poppins", size: 12 });
    expect(
      resolveEmailTextStyle(settings.typography, "body", { font: "mono" }),
    ).toEqual({ font: "mono", size: 18 });
    expect(resolveEmailTextStyle(settings.typography, "body", {})).toEqual({
      font: "poppins",
      size: 18,
    });
    expect(settings.typography.body).toEqual({ size: 18, color: "#112233" });
  });
  it("omits missing sections during resets so HTTP JSON never turns them into null", () => {
    for (const reset of [resetEmailTypography, resetEmailAppearance]) {
      expect(reset({})).not.toHaveProperty("layout");
      const headerOnly = reset({ layout: { header: { blocks: [] } } });
      expect(headerOnly.layout).not.toHaveProperty("footer");
      const footerOnly = reset({ layout: { footer: { blocks: [] } } });
      expect(footerOnly.layout).not.toHaveProperty("header");
      expect(Schema.is(AuthEmailSettings)(headerOnly)).toBe(true);
      expect(Schema.is(AuthEmailSettings)(footerOnly)).toBe(true);
    }
  });
  it("round-trips colored settings and scoped resets through the HTTP JSON codec without null fields", () => {
    const json = Schema.fromJsonString(AuthEmailSettings);
    const decode = Schema.decodeUnknownSync(json);
    const encode = Schema.encodeSync(json);
    for (const input of [
      settings,
      resetEmailTypography(settings),
      resetEmailAppearance(settings),
      {},
      resetEmailTypography({ layout: { header: { blocks: [] } } }),
    ]) {
      expect(decode(encode(input))).toEqual(input);
      expect(encode(input)).not.toContain(":null");
    }
    const reset = resetEmailTypography(settings);
    expect(reset.layout?.footer?.blocks[0]).not.toHaveProperty("style");
    expect(settings.typography.heading).toEqual({
      color: "#223344",
      alignment: "right",
    });
    expect(settings.layout.header.blocks[0].style.color).toBe("#334455");
  });
  it("permits incomplete translations only in previews, never publication or test delivery", () => {
    const draft = {
      layout: {
        header: {
          blocks: [
            { id: "text", type: "text", text: { en: "Hello", fr: " " } },
          ],
        },
      },
    };
    expect(Schema.is(AuthEmailDraftSettings)(draft)).toBe(true);
    expect(Schema.is(AuthEmailSettings)(draft)).toBe(false);
    expect(
      Schema.is(AuthEmailTestPayload)({
        kind: "sign-in",
        locale: "en",
        settings: draft,
      }),
    ).toBe(false);
    const emptyLink = {
      layout: {
        footer: {
          blocks: [
            {
              id: "link",
              type: "link",
              translations: {
                en: { label: "Help", url: "https://example.com" },
                fr: { label: "Aide", url: "" },
              },
            },
          ],
        },
      },
    };
    expect(Schema.is(AuthEmailDraftSettings)(emptyLink)).toBe(true);
    expect(Schema.is(AuthEmailSettings)(emptyLink)).toBe(false);
    expect(Schema.is(AuthEmailSettings)(settings)).toBe(true);
  });

  it("allows only explicit HTTPS websites and email addresses", () => {
    for (const url of [
      "https://example.com/help?locale=fr#contact",
      "https://support.other-domain.com",
      "mailto:support@example.com",
    ]) {
      expect(Schema.is(AuthEmailLinkDestination)(url)).toBe(true);
    }
    for (const url of [
      "http://example.com",
      "/help",
      "//example.com",
      "javascript:alert(1)",
      "data:text/html,test",
      "tel:+15555555",
      "https:example.com",
      "https://user:pass@example.com",
      "https://example.com/\n",
      "mailto:bad",
      "mailto:a@example.com?bcc=b@example.com",
      "mailto:a@example.com%0d%0aBcc:x@example.com",
      "https://example.com/{token}",
      "https://example.com/\\evil",
    ]) {
      expect(Schema.is(AuthEmailLinkDestination)(url)).toBe(false);
    }
  });

  it("bounds block counts, text, identities, placement, and typography", () => {
    const text = settings.layout.header.blocks[0];
    for (const invalid of [
      {
        layout: {
          header: {
            blocks: Array.from({ length: 9 }, (_, index) => ({
              ...text,
              id: String(index),
            })),
          },
        },
      },
      { layout: { header: { blocks: [text, text] } } },
      { layout: { header: { blocks: [text] }, footer: { blocks: [text] } } },
      {
        layout: {
          header: {
            blocks: [
              { ...text, text: { en: "x".repeat(4001), fr: "Bonjour" } },
            ],
          },
        },
      },
      { appearance: { logoPlacement: "sidebar" } },
      { typography: { font: "uploaded-font" } },
      { typography: { code: { size: 12 } } },
      { typography: { heading: { size: 9999 } } },
      { typography: { button: { size: 12 } } },
    ])
      expect(Schema.is(AuthEmailSettings)(invalid)).toBe(false);
    for (const [role, sizes] of Object.entries(emailSizeOptions)) {
      for (const size of sizes)
        expect(
          Schema.is(AuthEmailSettings)({ typography: { [role]: { size } } }),
        ).toBe(true);
    }
  });

  it("inherits typography by block, role, then shared font without replacing legacy defaults", () => {
    expect(emailTextStyle(undefined, "body")).toEqual({});
    expect(emailTextStyle(settings.typography, "body")).toMatchObject({
      fontFamily: "Poppins, Arial, Helvetica, sans-serif",
      fontSize: 18,
      lineHeight: "1.5",
    });
    expect(emailTextStyle(settings.typography, "help")).toMatchObject({
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: 14,
    });
    expect(
      emailTextStyle(settings.typography, "body", { font: "mono", size: 12 }),
    ).toMatchObject({
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: 12,
    });
  });

  it("resets typography without losing translations, order, appearance, or gaps", () => {
    const reset = resetEmailTypography(settings);
    expect(reset.typography).toBeUndefined();
    expect(reset.appearance).toEqual(settings.appearance);
    expect(reset.layout?.header?.blocks[0]).toEqual({
      ...settings.layout.header.blocks[0],
      style: undefined,
    });
    expect(reset.layout?.header?.gap).toBe("large");
    expect(reset.layout?.footer?.blocks.map((block) => block.id)).toEqual([
      "contact",
      "gap",
      "line",
    ]);
    expect(reset.templates).toEqual(settings.templates);
    expect(settings.layout.header.blocks[0].style.font).toBe("mono");
  });

  it("resets appearance while preserving bilingual content and block order", () => {
    const reset = resetEmailAppearance(settings);
    expect(reset.appearance).toBeUndefined();
    expect(reset.typography).toBeUndefined();
    expect(reset.layout?.header).toEqual({
      blocks: [
        { id: "intro", type: "text", text: { en: "Hello", fr: "Bonjour" } },
      ],
    });
    expect(reset.layout?.footer?.blocks[0]).toMatchObject({
      id: "contact",
      translations: settings.layout.footer.blocks[0].translations,
    });
    expect(reset.layout?.footer?.blocks[1]).toEqual({
      id: "gap",
      type: "spacer",
      size: "medium",
    });
    expect(reset.templates).toEqual(settings.templates);
  });
});
