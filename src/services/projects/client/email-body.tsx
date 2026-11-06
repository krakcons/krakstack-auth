import { useId, type ReactNode } from "react";
import { Struct } from "effect";
import { ChevronDownIcon, LockKeyholeIcon } from "lucide-react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { m } from "@/paraglide/messages";
import type {
  AuthEmailContent,
  AuthEmailKind,
  AuthEmailSettings,
} from "@/services/auth-emails/schema";
import { emailDefaultColors } from "@/services/auth-emails/typography";
import { EmailColorField, EmailRoleStyleEditor } from "./email-layout";

export const EmailBodyEditor = ({
  settings,
  content,
  defaults,
  kind,
  locale,
  brandName,
  cardAppearance,
  onChange,
  onContentChange,
}: {
  settings: AuthEmailSettings;
  content: AuthEmailContent;
  defaults: Required<AuthEmailContent>;
  kind: AuthEmailKind;
  locale: "en" | "fr";
  brandName: string;
  cardAppearance: ReactNode;
  onChange: (settings: AuthEmailSettings) => void;
  onContentChange: (content: AuthEmailContent) => void;
}) => {
  const id = useId();
  const showName = settings.appearance?.showProjectName !== false;
  const showFooting = settings.appearance?.showFooting !== false;
  const actionBackground = kind === "reset-password" ? "primary" : "muted";
  const updateField = (key: keyof AuthEmailContent, value: string) =>
    onContentChange(
      value ? { ...content, [key]: value } : Struct.omit(content, [key]),
    );
  const field = (
    key: keyof AuthEmailContent,
    label: string,
    multiline = false,
  ) => (
    <Field>
      <FieldLabel className="sr-only" htmlFor={`${id}-${key}`}>
        {label}
      </FieldLabel>
      {multiline ? (
        <Textarea
          id={`${id}-${key}`}
          rows={key === "body" ? 4 : 2}
          maxLength={4000}
          value={content[key] ?? ""}
          placeholder={defaults[key]}
          onChange={(event) => updateField(key, event.target.value)}
        />
      ) : (
        <Input
          id={`${id}-${key}`}
          maxLength={200}
          value={content[key] ?? ""}
          placeholder={defaults[key]}
          onChange={(event) => updateField(key, event.target.value)}
        />
      )}
    </Field>
  );
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        {m.project_email_content_scope()}
      </p>
      <details
        className="rounded-xl border p-4 [&[open]>summary>svg]:rotate-180"
        aria-label={m.project_email_card_appearance()}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {m.project_email_card_appearance()}
          <ChevronDownIcon
            className="size-4 shrink-0 transition-transform"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-4 pt-4">{cardAppearance}</div>
      </details>
      <details
        className="min-w-0 rounded-xl border p-4 [&[open]>summary>svg]:rotate-180"
        aria-label={m.project_email_heading()}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {m.project_email_heading()}
          <ChevronDownIcon
            className="size-4 shrink-0 transition-transform"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-3 pt-4">
          {field("title", m.project_email_heading())}
          <EmailRoleStyleEditor
            role="heading"
            settings={settings}
            onChange={onChange}
          />
        </div>
      </details>
      <details
        className="min-w-0 rounded-xl border p-4 [&[open]>summary>svg]:rotate-180"
        aria-label={m.project_email_message()}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {m.project_email_message()}
          <ChevronDownIcon
            className="size-4 shrink-0 transition-transform"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-3 pt-4">
          {field("body", m.project_email_message(), true)}
          <EmailRoleStyleEditor
            role="body"
            settings={settings}
            onChange={onChange}
          />
        </div>
      </details>
      <details
        className="min-w-0 rounded-xl border p-4 [&[open]>summary>svg]:rotate-180"
        aria-label={
          kind === "reset-password"
            ? m.project_email_action()
            : m.project_email_role_code()
        }
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {kind === "reset-password"
            ? m.project_email_action()
            : m.project_email_role_code()}
          <ChevronDownIcon
            className="size-4 shrink-0 transition-transform"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-3 pt-4">
          {kind === "reset-password"
            ? field("action", m.project_email_action())
            : null}
          <p className="text-muted-foreground flex items-start gap-2 text-xs">
            <LockKeyholeIcon className="size-3.5 shrink-0" aria-hidden="true" />
            {kind === "reset-password"
              ? m.project_email_protected_link()
              : m.project_email_protected_code()}
          </p>
          <EmailRoleStyleEditor
            role={kind === "reset-password" ? "button" : "code"}
            settings={settings}
            onChange={onChange}
          />
          <EmailColorField
            label={
              kind === "reset-password"
                ? m.project_email_primary()
                : m.project_email_muted()
            }
            value={settings.appearance?.[actionBackground]}
            fallback={emailDefaultColors[actionBackground]}
            onChange={(value) =>
              onChange({
                ...settings,
                appearance: value
                  ? { ...settings.appearance, [actionBackground]: value }
                  : Struct.omit(settings.appearance ?? {}, [actionBackground]),
              })
            }
          />
          {kind !== "reset-password" ? (
            <p className="text-muted-foreground text-xs">
              {m.email_otp_expiry({}, { locale })}
            </p>
          ) : null}
        </div>
      </details>
      <div className="relative">
        <details
          className="min-w-0 rounded-xl border p-4 [&[open]>summary>svg]:rotate-180"
          aria-label={m.project_email_help_text()}
        >
          <summary
            id={`${id}-footing-title`}
            className={`flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden ${showFooting ? "" : "text-muted-foreground"}`}
          >
            <span className="pr-12">{m.project_email_help_text()}</span>
            <ChevronDownIcon
              className="size-4 shrink-0 transition-transform"
              aria-hidden="true"
            />
          </summary>
          <div className="space-y-3 pt-4">
            {field("footer", m.project_email_help_text(), true)}
            <EmailRoleStyleEditor
              role="help"
              settings={settings}
              onChange={onChange}
            />
            <p className="text-muted-foreground text-xs">
              {m.project_email_help_style_scope()}
            </p>
          </div>
        </details>
        <Switch
          className="absolute top-4 right-11"
          aria-labelledby={`${id}-footing-title`}
          checked={showFooting}
          onCheckedChange={(showFooting) =>
            onChange({
              ...settings,
              appearance: { ...settings.appearance, showFooting },
            })
          }
        />
      </div>
      <div className="relative">
        <details
          className="min-w-0 rounded-xl border p-4 [&[open]>summary>svg]:rotate-180"
          aria-label={m.project_email_role_name()}
        >
          <summary
            id={`${id}-brand-title`}
            className={`flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden ${showName ? "" : "text-muted-foreground"}`}
          >
            <span className="pr-12">{m.project_email_role_name()}</span>
            <ChevronDownIcon
              className="size-4 shrink-0 transition-transform"
              aria-hidden="true"
            />
          </summary>
          <div className="space-y-3 pt-4">
            <p
              id={`${id}-brand-help`}
              className="text-muted-foreground text-xs"
            >
              {m.project_email_brand_line_help({ name: brandName })}
            </p>
            <EmailRoleStyleEditor
              role="projectName"
              settings={settings}
              onChange={onChange}
            />
          </div>
        </details>
        <Switch
          aria-labelledby={`${id}-brand-title`}
          aria-describedby={`${id}-brand-help`}
          className="absolute top-4 right-11"
          checked={showName}
          onCheckedChange={(showProjectName) =>
            onChange({
              ...settings,
              appearance: { ...settings.appearance, showProjectName },
            })
          }
        />
      </div>
    </div>
  );
};
