import { describe, expect, it } from "@effect/vitest";
import { Option, Schema } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ContactEmailsField,
  contactLimitReached,
  contactTranslations,
} from "./contact-fields";
import { ContactEmail } from "../schema";

const messages = {
  addEmail: "Add email",
  addPhone: "Add phone",
  addSocial: "Add social profile",
  addWebsite: "Add website",
  email: "Email",
  extension: "Extension",
  label: "Label",
  phone: "Phone",
  platform: "Platform",
  remove: "Remove",
  url: "URL",
};

const renderEmailsField = (count: number) => {
  const email = Schema.decodeUnknownSync(ContactEmail)({
    email: "ada@example.com",
    translations: [{ locale: "en", label: "Work" }],
  });

  return renderToStaticMarkup(
    createElement(ContactEmailsField, {
      field: {
        path: "emails",
        value: Array.from({ length: count }, () => email),
        onChange: () => undefined,
        onBlur: () => undefined,
        error: Option.none(),
        isTouched: false,
        isValidating: false,
        isDirty: false,
      },
      props: { locale: "en", maxItems: 8, messages },
    }),
  );
};

const addEmailButton = (count: number) =>
  renderEmailsField(count).match(
    /<button[^>]*aria-label="Add email"[^>]*>/,
  )?.[0];

describe("contactTranslations", () => {
  it("drops blank labels from another locale", () => {
    expect(
      contactTranslations([{ locale: "en", label: "" }], "fr", "Professionnel"),
    ).toEqual([{ locale: "fr", label: "Professionnel" }]);
  });

  it("preserves non-empty labels from another locale", () => {
    expect(
      contactTranslations(
        [{ locale: "en", label: "Work" }],
        "fr",
        "Professionnel",
      ),
    ).toEqual([
      { locale: "en", label: "Work" },
      { locale: "fr", label: "Professionnel" },
    ]);
  });

  it("replaces and clears the current locale label", () => {
    const translations = [
      { locale: "en", label: "Work" },
      { locale: "fr", label: "Professionnel" },
    ] as const;

    expect(contactTranslations(translations, "en", "Office")).toEqual([
      { locale: "fr", label: "Professionnel" },
      { locale: "en", label: "Office" },
    ]);
    expect(contactTranslations(translations, "en", "")).toEqual([
      { locale: "fr", label: "Professionnel" },
    ]);
    expect(contactTranslations(translations, "en", "   ")).toEqual([
      { locale: "fr", label: "Professionnel" },
    ]);
  });

  it("detects an optional contact limit", () => {
    expect(contactLimitReached(8, 8)).toBe(true);
    expect(contactLimitReached(7, 8)).toBe(false);
    expect(contactLimitReached(9)).toBe(false);
  });

  it("disables the rendered add action at the contact limit", () => {
    expect(addEmailButton(8)).toContain('disabled=""');
    expect(addEmailButton(7)).not.toContain('disabled=""');
  });
});
