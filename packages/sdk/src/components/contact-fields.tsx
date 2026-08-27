import { FormReact } from "@lucas-barake/effect-form-react";
import { Option } from "effect";
import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { ErrorMessage } from "@krak-stack/registry/effect-form";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ContactEmail,
  ContactLocale,
  ContactPhone,
  ContactSocial,
  ContactTranslation,
  ContactWebsite,
  OrganizationAddress,
  SocialPlatform,
} from "@krak-stack/auth/schema";

export type ContactFieldMessages = {
  addEmail: string;
  addPhone: string;
  addSocial: string;
  addWebsite: string;
  email: string;
  extension: string;
  label: string;
  phone: string;
  platform: string;
  remove: string;
  url: string;
};

export type ContactAddressFieldMessages = ContactFieldMessages & {
  addAddress: string;
  country: string;
  locality: string;
  postalCode: string;
  region: string;
  street: string;
};

type ContactFieldProps = {
  locale: ContactLocale;
  maxItems?: number;
  messages: ContactFieldMessages;
};

type ContactAddressFieldProps = {
  locale: ContactLocale;
  messages: ContactAddressFieldMessages;
};

const socialPlatform = (value: string | null): SocialPlatform | null => {
  switch (value) {
    case "facebook":
    case "github":
    case "instagram":
    case "linkedin":
    case "tiktok":
    case "x":
    case "youtube":
      return value;
    default:
      return null;
  }
};

const contactLabel = (
  translations: ReadonlyArray<ContactTranslation> | undefined,
  locale: ContactLocale,
) =>
  translations?.find((translation) => translation.locale === locale)?.label ??
  "";

export const contactTranslations = (
  translations: ReadonlyArray<ContactTranslation> | undefined,
  locale: ContactLocale,
  label: string,
): ContactTranslation[] => [
  ...(translations ?? []).filter(
    (translation) =>
      translation.locale !== locale && Boolean(translation.label.trim()),
  ),
  ...(label.trim() ? [{ locale, label }] : []),
];

export const contactLimitReached = (valueCount: number, maxItems?: number) =>
  maxItems !== undefined && valueCount >= maxItems;

const ContactInput = ({
  className,
  id,
  label,
  onBlur,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  className?: string;
  id: string;
  label: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "email" | "tel" | "text" | "url";
  value: string;
}) => (
  <div className={className}>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Input
      id={id}
      className="mt-2"
      value={value}
      type={type}
      placeholder={placeholder}
      onBlur={onBlur}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);

const ContactLabelInput = ({
  id,
  locale,
  messages,
  onBlur,
  onChange,
  translations,
}: {
  id: string;
  locale: ContactLocale;
  messages: ContactFieldMessages;
  onBlur: () => void;
  onChange: (translations: ContactTranslation[]) => void;
  translations: ReadonlyArray<ContactTranslation> | undefined;
}) => (
  <ContactInput
    id={id}
    label={messages.label}
    value={contactLabel(translations, locale)}
    onBlur={onBlur}
    onChange={(label) =>
      onChange(contactTranslations(translations, locale, label))
    }
  />
);

const RepeatableContactField = <T,>({
  addLabel,
  emptyValue,
  error,
  maxItems,
  onChange,
  path,
  removeLabel,
  render,
  values,
}: {
  addLabel: string;
  emptyValue: T;
  error: string | undefined;
  maxItems: number | undefined;
  onChange: (values: ReadonlyArray<T>) => void;
  path: string;
  removeLabel: string;
  render: (value: T, index: number, onChange: (value: T) => void) => ReactNode;
  values: ReadonlyArray<T>;
}) => (
  <Field>
    <div className="flex flex-col gap-3">
      {values.map((value, index) => (
        <div
          className="bg-muted/20 relative rounded-lg border p-4 pr-12"
          key={`${path}-${index}`}
        >
          {render(value, index, (next) =>
            onChange(
              values.map((item, itemIndex) =>
                itemIndex === index ? next : item,
              ),
            ),
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            aria-label={removeLabel}
            onClick={() =>
              onChange(values.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        aria-label={addLabel}
        disabled={contactLimitReached(values.length, maxItems)}
        onClick={() => onChange([...values, emptyValue])}
      >
        <Plus />
        {addLabel}
      </Button>
      {error ? <ErrorMessage text={error} /> : null}
    </div>
  </Field>
);

const SocialPlatformSelect = ({
  messages,
  value,
  onChange,
}: {
  messages: ContactFieldMessages;
  value: SocialPlatform;
  onChange: (value: SocialPlatform) => void;
}) => {
  const items = [
    { label: "Facebook", value: "facebook" },
    { label: "GitHub", value: "github" },
    { label: "Instagram", value: "instagram" },
    { label: "LinkedIn", value: "linkedin" },
    { label: "TikTok", value: "tiktok" },
    { label: "X", value: "x" },
    { label: "YouTube", value: "youtube" },
  ];

  return (
    <div>
      <FieldLabel>{messages.platform}</FieldLabel>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => {
          const platform = socialPlatform(next);
          if (platform) onChange(platform);
        }}
      >
        <SelectTrigger className="mt-2 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export const ContactEmailsField: FormReact.FieldComponent<
  ReadonlyArray<ContactEmail>,
  ContactFieldProps
> = ({ field, props }) => (
  <RepeatableContactField
    addLabel={props.messages.addEmail}
    emptyValue={{
      email: "",
      translations: [{ locale: props.locale, label: "" }],
    }}
    error={Option.isSome(field.error) ? field.error.value : undefined}
    maxItems={props.maxItems}
    path={field.path}
    removeLabel={props.messages.remove}
    values={field.value}
    onChange={field.onChange}
    render={(contact, index, update) => (
      <div className="grid gap-3 sm:grid-cols-2">
        <ContactInput
          id={`${field.path}-${index}-email`}
          label={props.messages.email}
          placeholder="team@example.com"
          type="email"
          value={contact.email}
          onBlur={field.onBlur}
          onChange={(email) => update({ ...contact, email })}
        />
        <ContactLabelInput
          id={`${field.path}-${index}-label`}
          locale={props.locale}
          messages={props.messages}
          translations={contact.translations}
          onBlur={field.onBlur}
          onChange={(translations) => update({ ...contact, translations })}
        />
      </div>
    )}
  />
);

export const ContactPhonesField: FormReact.FieldComponent<
  ReadonlyArray<ContactPhone>,
  ContactFieldProps
> = ({ field, props }) => (
  <RepeatableContactField
    addLabel={props.messages.addPhone}
    emptyValue={{
      number: "",
      translations: [{ locale: props.locale, label: "" }],
    }}
    error={Option.isSome(field.error) ? field.error.value : undefined}
    maxItems={props.maxItems}
    path={field.path}
    removeLabel={props.messages.remove}
    values={field.value}
    onChange={field.onChange}
    render={(phone, index, update) => (
      <div className="grid gap-3 sm:grid-cols-2">
        <ContactInput
          id={`${field.path}-${index}-number`}
          label={props.messages.phone}
          placeholder="+1 514 555 0100"
          type="tel"
          value={phone.number}
          onBlur={field.onBlur}
          onChange={(number) => update({ ...phone, number })}
        />
        <ContactInput
          id={`${field.path}-${index}-extension`}
          label={props.messages.extension}
          value={phone.extension ?? ""}
          onBlur={field.onBlur}
          onChange={(extension) =>
            update({
              ...phone,
              ...(extension ? { extension } : { extension: undefined }),
            })
          }
        />
        <ContactLabelInput
          id={`${field.path}-${index}-label`}
          locale={props.locale}
          messages={props.messages}
          translations={phone.translations}
          onBlur={field.onBlur}
          onChange={(translations) => update({ ...phone, translations })}
        />
      </div>
    )}
  />
);

export const ContactWebsitesField: FormReact.FieldComponent<
  ReadonlyArray<ContactWebsite>,
  ContactFieldProps
> = ({ field, props }) => (
  <RepeatableContactField
    addLabel={props.messages.addWebsite}
    emptyValue={{
      url: "",
      translations: [{ locale: props.locale, label: "" }],
    }}
    error={Option.isSome(field.error) ? field.error.value : undefined}
    maxItems={props.maxItems}
    path={field.path}
    removeLabel={props.messages.remove}
    values={field.value}
    onChange={field.onChange}
    render={(website, index, update) => (
      <div className="grid gap-3 sm:grid-cols-2">
        <ContactInput
          id={`${field.path}-${index}-url`}
          label={props.messages.url}
          placeholder="https://example.com"
          type="url"
          value={website.url}
          onBlur={field.onBlur}
          onChange={(url) => update({ ...website, url })}
        />
        <ContactLabelInput
          id={`${field.path}-${index}-label`}
          locale={props.locale}
          messages={props.messages}
          translations={website.translations}
          onBlur={field.onBlur}
          onChange={(translations) => update({ ...website, translations })}
        />
      </div>
    )}
  />
);

export const ContactSocialsField: FormReact.FieldComponent<
  ReadonlyArray<ContactSocial>,
  ContactFieldProps
> = ({ field, props }) => (
  <RepeatableContactField
    addLabel={props.messages.addSocial}
    emptyValue={{
      platform: "linkedin",
      url: "",
      translations: [{ locale: props.locale, label: "" }],
    }}
    error={Option.isSome(field.error) ? field.error.value : undefined}
    maxItems={props.maxItems}
    path={field.path}
    removeLabel={props.messages.remove}
    values={field.value}
    onChange={field.onChange}
    render={(social, index, update) => (
      <div className="grid gap-3 sm:grid-cols-2">
        <SocialPlatformSelect
          messages={props.messages}
          value={social.platform}
          onChange={(platform) => update({ ...social, platform })}
        />
        <ContactInput
          id={`${field.path}-${index}-url`}
          label={props.messages.url}
          placeholder="https://example.com/profile"
          type="url"
          value={social.url}
          onBlur={field.onBlur}
          onChange={(url) => update({ ...social, url })}
        />
        <ContactLabelInput
          id={`${field.path}-${index}-label`}
          locale={props.locale}
          messages={props.messages}
          translations={social.translations}
          onBlur={field.onBlur}
          onChange={(translations) => update({ ...social, translations })}
        />
      </div>
    )}
  />
);

export const ContactAddressesField: FormReact.FieldComponent<
  ReadonlyArray<OrganizationAddress>,
  ContactAddressFieldProps
> = ({ field, props }) => {
  const inputs: ReadonlyArray<{
    key: "streetAddress" | "locality" | "region" | "postalCode" | "country";
    label: string;
    className?: string;
  }> = [
    {
      key: "streetAddress",
      label: props.messages.street,
      className: "sm:col-span-2",
    },
    { key: "locality", label: props.messages.locality },
    { key: "region", label: props.messages.region },
    { key: "postalCode", label: props.messages.postalCode },
    { key: "country", label: props.messages.country },
  ];

  return (
    <RepeatableContactField
      addLabel={props.messages.addAddress}
      emptyValue={{
        translations: [{ locale: props.locale, label: "" }],
      }}
      error={Option.isSome(field.error) ? field.error.value : undefined}
      maxItems={undefined}
      path={field.path}
      removeLabel={props.messages.remove}
      values={field.value}
      onChange={field.onChange}
      render={(address, index, update) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <ContactLabelInput
            id={`${field.path}-${index}-label`}
            locale={props.locale}
            messages={props.messages}
            translations={address.translations}
            onBlur={field.onBlur}
            onChange={(translations) => update({ ...address, translations })}
          />
          {inputs.map((input) => (
            <ContactInput
              {...(input.className ? { className: input.className } : {})}
              id={`${field.path}-${index}-${input.key}`}
              key={input.key}
              label={input.label}
              value={address[input.key] ?? ""}
              onBlur={field.onBlur}
              onChange={(value) => update({ ...address, [input.key]: value })}
            />
          ))}
        </div>
      )}
    />
  );
};
