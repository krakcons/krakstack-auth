import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  UserContactEmailsForm,
  UserContactPhonesForm,
  UserContactSocialsForm,
  UserContactWebsitesForm,
  userContactEmailDefaults,
  userMetadataFromForm,
} from "./user-button";

describe("userContactEmailDefaults", () => {
  it("keeps the primary sign-in email out of the editable contacts", () => {
    for (const metadata of [{}, { emails: [] }]) {
      expect(userContactEmailDefaults(metadata, " ada@example.com ")).toEqual(
        [],
      );
    }
  });

  it("preserves existing contact emails and localized labels", () => {
    const emails = [
      {
        email: "work@example.com",
        translations: [{ locale: "fr" as const, label: "Travail" }],
      },
    ];
    expect(userContactEmailDefaults({ emails }, "ada@example.com")).toEqual(
      emails,
    );
  });

  it("does not add a blank contact email", () => {
    expect(userContactEmailDefaults({}, " ")).toEqual([]);
  });

  it("removes existing copies of the primary email from the editable contacts", () => {
    expect(
      userContactEmailDefaults(
        {
          emails: [
            { email: "ADA@example.com", translations: [] },
            { email: "work@example.com", translations: [] },
          ],
        },
        "ada@example.com",
      ),
    ).toEqual([{ email: "work@example.com", translations: [] }]);
  });
});

describe("userMetadataFromForm", () => {
  it("accepts draft values that normalization can clean", () => {
    expect(
      Schema.decodeUnknownSync(UserContactEmailsForm)([
        {
          email: " ada@example.com ",
          translations: [{ locale: "en", label: " " }],
        },
        { email: " ", translations: [] },
      ]),
    ).toHaveLength(2);
    expect(
      Schema.decodeUnknownSync(UserContactPhonesForm)([
        { number: " ", extension: " ", translations: [] },
      ]),
    ).toHaveLength(1);
    expect(
      Schema.decodeUnknownSync(UserContactWebsitesForm)([
        { url: " ", translations: [] },
      ]),
    ).toHaveLength(1);
    expect(
      Schema.decodeUnknownSync(UserContactSocialsForm)([
        { platform: "linkedin", url: " ", translations: [] },
      ]),
    ).toHaveLength(1);
  });

  it("normalizes all contact methods and preserves localized labels", () => {
    expect(
      userMetadataFromForm({
        name: "Ada Lovelace",
        image: null,
        emails: [
          {
            email: " ada@example.com ",
            translations: [
              { locale: "en", label: " Work " },
              { locale: "fr", label: " Travail " },
            ],
          },
        ],
        phones: [
          {
            number: " +1 514 555 0100 ",
            extension: " 123 ",
            translations: [{ locale: "en", label: " Mobile " }],
          },
        ],
        websites: [
          {
            url: " https://example.com ",
            translations: [{ locale: "en", label: " Website " }],
          },
        ],
        socials: [
          {
            platform: "linkedin",
            url: " https://linkedin.com/in/example ",
            translations: [{ locale: "en", label: " LinkedIn " }],
          },
        ],
      }),
    ).toEqual({
      emails: [
        {
          email: "ada@example.com",
          translations: [
            { locale: "en", label: "Work" },
            { locale: "fr", label: "Travail" },
          ],
        },
      ],
      phones: [
        {
          number: "+1 514 555 0100",
          extension: "123",
          translations: [{ locale: "en", label: "Mobile" }],
        },
      ],
      websites: [
        {
          url: "https://example.com",
          translations: [{ locale: "en", label: "Website" }],
        },
      ],
      socials: [
        {
          platform: "linkedin",
          url: "https://linkedin.com/in/example",
          translations: [{ locale: "en", label: "LinkedIn" }],
        },
      ],
    });
  });

  it("omits blank rows, labels, and phone extensions", () => {
    expect(
      userMetadataFromForm({
        name: "Ada Lovelace",
        image: null,
        emails: [
          {
            email: " ",
            translations: [{ locale: "en", label: "Work" }],
          },
        ],
        phones: [
          {
            number: " ",
            translations: [{ locale: "en", label: "Mobile" }],
          },
          {
            number: "+1 514 555 0100",
            extension: " ",
            translations: [
              { locale: "en", label: "Mobile" },
              { locale: "fr", label: " " },
            ],
          },
        ],
        websites: [
          {
            url: " ",
            translations: [{ locale: "en", label: "Website" }],
          },
        ],
        socials: [
          {
            platform: "linkedin",
            url: " ",
            translations: [{ locale: "en", label: "LinkedIn" }],
          },
        ],
      }),
    ).toEqual({
      emails: [],
      phones: [
        {
          number: "+1 514 555 0100",
          translations: [{ locale: "en", label: "Mobile" }],
        },
      ],
      websites: [],
      socials: [],
    });
  });

  it("rejects contact collections over the write limit", () => {
    expect(() =>
      userMetadataFromForm({
        name: "Ada Lovelace",
        image: null,
        emails: Array.from({ length: 9 }, () => ({
          email: "ada@example.com",
          translations: [{ locale: "en" as const, label: "Work" }],
        })),
        phones: [],
        websites: [],
        socials: [],
      }),
    ).toThrow();
  });
});
