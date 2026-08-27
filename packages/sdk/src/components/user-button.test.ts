import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  UserContactEmailsForm,
  UserContactPhonesForm,
  UserContactSocialsForm,
  UserContactWebsitesForm,
  userMetadataFromForm,
} from "./user-button";

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
