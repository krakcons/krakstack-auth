import { useId, type ReactNode } from "react";
import { Struct } from "effect";
import { LockKeyholeIcon } from "lucide-react";
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
      <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
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
      <details className="space-y-4 rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          {m.project_email_email_details()}
        </summary>
        {field("subject", m.project_email_subject())}
        {field("preview", m.project_email_preheader())}
      </details>
      <p className="text-muted-foreground text-xs">
        {m.project_email_content_help({ appName: "{appName}" })}
      </p>
      <fieldset className="min-w-0 space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">
          {m.project_email_heading()}
        </legend>
        {field("title", m.project_email_heading())}
        <EmailRoleStyleEditor
          role="heading"
          settings={settings}
          onChange={onChange}
        />
      </fieldset>
      <fieldset className="min-w-0 space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">
          {m.project_email_message()}
        </legend>
        {field("body", m.project_email_message(), true)}
        <EmailRoleStyleEditor
          role="body"
          settings={settings}
          onChange={onChange}
        />
      </fieldset>
      <fieldset className="min-w-0 space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">
          {kind === "reset-password"
            ? m.project_email_action()
            : m.project_email_role_code()}
        </legend>
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
      </fieldset>
      <fieldset className="min-w-0 space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">
          {m.project_email_help_text()}
        </legend>
        {field("footer", m.project_email_help_text(), true)}
        <EmailRoleStyleEditor
          role="help"
          settings={settings}
          onChange={onChange}
        />
        <p className="text-muted-foreground text-xs">
          {m.project_email_help_style_scope()}
        </p>
      </fieldset>
      <fieldset className="min-w-0 space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">
          {m.project_email_role_name()}
        </legend>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <FieldLabel htmlFor={`${id}-brand`}>
              {m.project_email_brand_line()}
            </FieldLabel>
            <p
              id={`${id}-brand-help`}
              className="text-muted-foreground text-xs"
            >
              {m.project_email_brand_line_help({ name: brandName })}
            </p>
          </div>
          <Switch
            id={`${id}-brand`}
            aria-describedby={`${id}-brand-help`}
            className="mt-0.5"
            checked={showName}
            onCheckedChange={(showProjectName) =>
              onChange({
                ...settings,
                appearance: { ...settings.appearance, showProjectName },
              })
            }
          />
        </div>
        {showName ? (
          <EmailRoleStyleEditor
            role="projectName"
            settings={settings}
            onChange={onChange}
          />
        ) : null}
      </fieldset>
      <details className="space-y-4 rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          {m.project_email_card_appearance()}
        </summary>
        {cardAppearance}
      </details>
    </div>
  );
};
