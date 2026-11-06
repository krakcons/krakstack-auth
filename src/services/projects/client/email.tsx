import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { Schema, Struct } from "effect";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  ImageIcon,
  MoreHorizontalIcon,
  SendIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { assetUrl } from "@/lib/assets";
import { authBaseUrl } from "@/services/auth/client";
import { defaultAuthEmailContent } from "@/services/auth-emails/content";
import {
  AuthEmailKind,
  AuthEmailSettings,
  type AuthEmailContent,
  type AuthEmailPreviewPayload,
} from "@/services/auth-emails/schema";
import type { Project } from "../schema";
import {
  projectEmailPreviewAtom,
  testProjectEmailAtom,
  updateProjectEmailAtom,
} from "./atom";

const emailKinds = () =>
  [
    { value: "sign-in", label: m.project_email_sign_in() },
    { value: "email-verification", label: m.project_email_verification() },
    { value: "forget-password", label: m.project_email_password_otp() },
    { value: "change-email", label: m.project_email_change_email() },
    { value: "two-factor", label: m.project_email_two_factor() },
    { value: "reset-password", label: m.project_email_password_link() },
  ] satisfies Array<{ value: AuthEmailKind; label: string }>;

const contentFields = () =>
  [
    { key: "subject", label: m.project_email_subject(), multiline: false },
    { key: "preview", label: m.project_email_preheader(), multiline: false },
    { key: "title", label: m.project_email_heading(), multiline: false },
    { key: "body", label: m.project_email_body(), multiline: true },
    { key: "footer", label: m.project_email_footer(), multiline: true },
    { key: "action", label: m.project_email_action(), multiline: false },
  ] satisfies Array<{
    key: keyof AuthEmailContent;
    label: string;
    multiline: boolean;
  }>;

const colorFields = () =>
  [
    { key: "background", label: m.project_email_background() },
    { key: "foreground", label: m.project_email_foreground() },
    { key: "card", label: m.project_email_card() },
    { key: "primary", label: m.project_email_primary() },
    { key: "primaryForeground", label: m.project_email_primary_foreground() },
    { key: "muted", label: m.project_email_muted() },
    { key: "mutedForeground", label: m.project_email_muted_foreground() },
    { key: "border", label: m.project_email_border() },
  ] satisfies Array<{
    key: keyof NonNullable<AuthEmailSettings["appearance"]>;
    label: string;
  }>;

const numberFields = () =>
  [
    {
      key: "logoWidth",
      label: m.project_email_logo_width(),
      min: 32,
      max: 400,
      fallback: 267,
    },
    {
      key: "logoSpacingTop",
      label: m.project_email_logo_spacing_top(),
      min: 0,
      max: 96,
      fallback: 0,
    },
    {
      key: "logoSpacingBottom",
      label: m.project_email_logo_spacing_bottom(),
      min: 0,
      max: 96,
      fallback: 10,
    },
    {
      key: "padding",
      label: m.project_email_padding(),
      min: 16,
      max: 64,
      fallback: 32,
    },
    {
      key: "radius",
      label: m.project_email_radius(),
      min: 0,
      max: 32,
      fallback: 0,
    },
  ] satisfies Array<{
    key:
      | "logoWidth"
      | "logoSpacingTop"
      | "logoSpacingBottom"
      | "padding"
      | "radius";
    label: string;
    min: number;
    max: number;
    fallback: number;
  }>;

const EmailPreview = ({
  projectId,
  payload,
  valid,
}: {
  projectId: string;
  payload: AuthEmailPreviewPayload;
  valid: boolean;
}) => {
  const [draft, setDraft] = useState(payload);
  useEffect(() => {
    if (!valid) return;
    const timer = setTimeout(() => setDraft(payload), 400);
    return () => clearTimeout(timer);
  }, [payload, valid]);
  const input = useMemo(
    () => ({ params: { id: projectId }, payload: draft }),
    [projectId, draft],
  );
  const result = useAtomValue(projectEmailPreviewAtom(input));
  const preview = AsyncResult.getOrElse(result, () => null);
  return (
    <section
      className="bg-muted/25 flex flex-col gap-3 rounded-xl border p-4"
      aria-busy={(valid && draft !== payload) || result.waiting}
    >
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{m.project_email_preview()}</h4>
        {(valid && draft !== payload) || result.waiting ? (
          <p role="status" className="text-muted-foreground text-xs">
            {m.project_email_preview_loading()}
          </p>
        ) : null}
      </div>
      {!valid ? (
        <p className="text-muted-foreground text-xs">
          {m.project_email_preview_invalid()}
        </p>
      ) : null}
      {AsyncResult.isFailure(result) ? (
        <p role="alert">{m.project_email_preview_error()}</p>
      ) : null}
      {preview ? (
        <>
          <p className="bg-background rounded-md border px-3 py-2 text-sm break-words">
            <strong>{m.project_email_subject()}: </strong>
            {preview.subject}
          </p>
          <iframe
            title={m.project_email_preview()}
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={preview.html}
            className="h-[480px] w-full rounded-lg border bg-white sm:h-[540px]"
          />
          <details>
            <summary className="text-muted-foreground cursor-pointer text-xs">
              {m.project_email_plain_text()}
            </summary>
            <pre className="mt-3 rounded-md border p-4 text-sm whitespace-pre-wrap">
              {preview.text}
            </pre>
          </details>
        </>
      ) : null}
    </section>
  );
};

const sameEmailSettings = Schema.toEquivalence(AuthEmailSettings);

export const ProjectEmailEditor = ({ project }: { project: Project }) => {
  const [settings, setSettings] = useState<AuthEmailSettings>(
    () => project.data.email ?? {},
  );
  const [kind, setKind] = useState<AuthEmailKind>("email-verification");
  const [locale, setLocale] = useState<"en" | "fr">("en");
  const [saved, setSaved] = useState(false);
  const [savedSettings, setSavedSettings] = useState<AuthEmailSettings>(
    () => project.data.email ?? {},
  );
  const [tested, setTested] = useState(false);
  const save = useAtomSet(updateProjectEmailAtom);
  const saveResult = useAtomValue(updateProjectEmailAtom);
  const test = useAtomSet(testProjectEmailAtom);
  const testResult = useAtomValue(testProjectEmailAtom);
  useAtomSubscribe(updateProjectEmailAtom, (result) => {
    if (
      AsyncResult.isSuccess(result) &&
      !result.waiting &&
      result.value.id === project.id
    ) {
      setSavedSettings(result.value.data.email ?? {});
      setSaved(true);
    }
  });
  useAtomSubscribe(testProjectEmailAtom, (result) => {
    if (AsyncResult.isSuccess(result) && !result.waiting) setTested(true);
  });
  const change = (next: AuthEmailSettings) => {
    setSettings(next);
    setSaved(false);
    setTested(false);
  };
  const valid = Schema.is(AuthEmailSettings)(settings);
  const dirty = !sameEmailSettings(settings, savedSettings);
  const defaults = defaultAuthEmailContent({
    kind,
    locale,
    appName: project.name,
  });
  const content = settings.templates?.[kind]?.[locale] ?? {};
  const payload = useMemo(
    () => ({ kind, locale, settings }),
    [kind, locale, settings],
  );
  const updateContent = (next: AuthEmailContent) =>
    change({
      ...settings,
      templates: {
        ...settings.templates,
        [kind]: { ...settings.templates?.[kind], [locale]: next },
      },
    });
  const id = (field: string) => `email-${project.id}-${field}`;
  const logo = assetUrl(project.logo, authBaseUrl);
  const numberInput = ({
    key,
    label,
    min,
    max,
    fallback,
  }: ReturnType<typeof numberFields>[number]) => (
    <Field key={key}>
      <FieldLabel htmlFor={id(key)}>{label}</FieldLabel>
      <Input
        id={id(key)}
        type="number"
        min={min}
        max={max}
        step={1}
        value={settings.appearance?.[key] ?? ""}
        placeholder={String(fallback)}
        onChange={(event) =>
          change({
            ...settings,
            appearance:
              event.target.value === ""
                ? Struct.omit(settings.appearance ?? {}, [key])
                : { ...settings.appearance, [key]: event.target.valueAsNumber },
          })
        }
      />
    </Field>
  );
  const alignmentInput = (
    key: "alignment" | "logoAlignment",
    label: string,
  ) => (
    <Field>
      <FieldLabel htmlFor={id(key)}>{label}</FieldLabel>
      <Select
        value={
          settings.appearance?.[key] ??
          (key === "logoAlignment"
            ? settings.appearance?.alignment
            : undefined) ??
          "left"
        }
        items={[
          { value: "left", label: m.project_email_left() },
          { value: "center", label: m.project_email_center() },
          { value: "right", label: m.project_email_right() },
        ]}
        onValueChange={(value) => {
          if (value === "left" || value === "center" || value === "right")
            change({
              ...settings,
              appearance: { ...settings.appearance, [key]: value },
            });
        }}
      >
        <SelectTrigger id={id(key)} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="left">{m.project_email_left()}</SelectItem>
          <SelectItem value="center">{m.project_email_center()}</SelectItem>
          <SelectItem value="right">{m.project_email_right()}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
  return (
    <section className="flex flex-col gap-5" id="emails">
      <div className="space-y-2">
        <h3 className="font-medium">{m.project_email_title()}</h3>
        <p className="text-muted-foreground text-sm">
          {m.project_email_description()}
        </p>
      </div>
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && dirty && !saveResult.waiting)
            save({ params: { id: project.id }, payload: settings });
        }}
      >
        <fieldset
          disabled={saveResult.waiting}
          className="flex min-w-0 flex-col gap-5"
        >
          <div className="bg-muted/25 grid items-end gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_auto]">
            <Field>
              <FieldLabel htmlFor={id("kind")}>
                {m.project_email_kind()}
              </FieldLabel>
              <Select
                value={kind}
                items={emailKinds()}
                onValueChange={(value) => {
                  if (Schema.is(AuthEmailKind)(value)) {
                    setKind(value);
                    setTested(false);
                  }
                }}
              >
                <SelectTrigger id={id("kind")} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {emailKinds().map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={id("locale")}>
                {m.project_email_language()}
              </FieldLabel>
              <Select
                value={locale}
                items={[
                  { value: "en", label: m.project_email_english() },
                  { value: "fr", label: m.project_email_french() },
                ]}
                onValueChange={(value) => {
                  if (value === "en" || value === "fr") {
                    setLocale(value);
                    setTested(false);
                  }
                }}
              >
                <SelectTrigger id={id("locale")} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">
                    {m.project_email_english()}
                  </SelectItem>
                  <SelectItem value="fr">{m.project_email_french()}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Button
              type="button"
              variant="outline"
              className="bg-background"
              title={m.project_email_test_help()}
              aria-describedby={id("test-help")}
              disabled={!valid || testResult.waiting}
              onClick={() => {
                setTested(false);
                test({ params: { id: project.id }, payload });
              }}
            >
              <SendIcon aria-hidden="true" />
              {m.project_email_test()}
            </Button>
            <p id={id("test-help")} className="sr-only">
              {m.project_email_test_help()}
            </p>
          </div>
          {tested ? (
            <p role="status" className="text-sm">
              {m.project_email_test_sent()}
            </p>
          ) : null}
          {AsyncResult.isFailure(testResult) ? (
            <p role="alert" className="text-destructive text-sm">
              {m.project_email_test_error()}
            </p>
          ) : null}
          <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Tabs defaultValue="content" className="min-w-0 gap-4">
              <TabsList
                className="w-full"
                aria-label={m.project_email_edit_sections()}
              >
                <TabsTrigger value="content" type="button">
                  {m.project_email_content()}
                </TabsTrigger>
                <TabsTrigger value="appearance" type="button">
                  {m.project_email_appearance()}
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="content"
                className="space-y-4 rounded-xl border p-4"
              >
                <p className="text-muted-foreground text-sm">
                  {m.project_email_content_help({ appName: "{appName}" })}
                </p>
                {contentFields()
                  .filter(
                    ({ key }) => key !== "action" || kind === "reset-password",
                  )
                  .map(({ key, label, multiline }) => (
                    <Field key={`${kind}-${locale}-${key}`}>
                      <FieldLabel htmlFor={id(key)}>{label}</FieldLabel>
                      {multiline ? (
                        <Textarea
                          id={id(key)}
                          rows={key === "body" ? 5 : 3}
                          maxLength={4000}
                          value={content[key] ?? ""}
                          placeholder={defaults[key]}
                          onChange={(event) =>
                            updateContent({
                              ...content,
                              [key]: event.target.value || undefined,
                            })
                          }
                        />
                      ) : (
                        <Input
                          id={id(key)}
                          maxLength={200}
                          value={content[key] ?? ""}
                          placeholder={defaults[key]}
                          onChange={(event) =>
                            updateContent({
                              ...content,
                              [key]: event.target.value || undefined,
                            })
                          }
                        />
                      )}
                    </Field>
                  ))}
              </TabsContent>
              <TabsContent value="appearance" className="space-y-4">
                <p className="bg-muted/50 rounded-lg px-3 py-2 text-sm font-medium">
                  {m.project_email_appearance_scope()}
                </p>
                <section
                  className="space-y-4 rounded-xl border p-4"
                  aria-labelledby={id("logo-heading")}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-muted/25 flex size-12 shrink-0 items-center justify-center rounded-lg border p-2">
                      {logo ? (
                        <img
                          src={logo}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <ImageIcon
                          className="text-muted-foreground size-5"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4
                        id={id("logo-heading")}
                        className="text-sm font-medium"
                      >
                        {m.project_email_logo()}
                      </h4>
                      <a
                        href="#project-details"
                        className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
                      >
                        {m.project_email_manage_logo()}
                      </a>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {numberFields()
                      .filter(({ key }) => key === "logoWidth")
                      .map(numberInput)}
                    {alignmentInput(
                      "logoAlignment",
                      m.project_email_logo_alignment(),
                    )}
                  </div>
                  <details className="group/advanced border-t pt-3">
                    <summary className="text-muted-foreground flex cursor-pointer list-none items-center justify-between text-sm [&::-webkit-details-marker]:hidden">
                      {m.project_email_advanced()}
                      <ChevronDownIcon
                        aria-hidden="true"
                        className="size-4 transition-transform group-open/advanced:rotate-180"
                      />
                    </summary>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {numberFields()
                        .filter(
                          ({ key }) =>
                            key === "logoSpacingTop" ||
                            key === "logoSpacingBottom",
                        )
                        .map(numberInput)}
                    </div>
                  </details>
                </section>
                <details className="group/colors rounded-xl border p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
                    {m.project_email_colors()}
                    <ChevronDownIcon
                      aria-hidden="true"
                      className="size-4 transition-transform group-open/colors:rotate-180"
                    />
                  </summary>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {m.project_email_appearance_help()}
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {colorFields().map(({ key, label }) => (
                      <Field key={key}>
                        <FieldLabel htmlFor={id(key)}>{label}</FieldLabel>
                        <div className="flex gap-2">
                          <ColorPicker
                            hidden
                            className="w-9 shrink-0 justify-center"
                            locale={getLocale()}
                            messages={{
                              [getLocale()]: {
                                open: m.project_email_choose_color({
                                  field: label,
                                }),
                              },
                            }}
                            value={settings.appearance?.[key] || "#FFFFFF"}
                            disabled={saveResult.waiting}
                            onValueChange={(value) =>
                              change({
                                ...settings,
                                appearance: {
                                  ...settings.appearance,
                                  [key]: value,
                                },
                              })
                            }
                          />
                          <Input
                            id={id(key)}
                            className="min-w-0 font-mono"
                            value={settings.appearance?.[key] ?? ""}
                            placeholder="#RRGGBB"
                            maxLength={7}
                            onChange={(event) =>
                              change({
                                ...settings,
                                appearance: event.target.value
                                  ? {
                                      ...settings.appearance,
                                      [key]: event.target.value,
                                    }
                                  : Struct.omit(settings.appearance ?? {}, [
                                      key,
                                    ]),
                              })
                            }
                          />
                        </div>
                      </Field>
                    ))}
                  </div>
                </details>
                <details className="group/layout rounded-xl border p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
                    {m.project_email_layout()}
                    <ChevronDownIcon
                      aria-hidden="true"
                      className="size-4 transition-transform group-open/layout:rotate-180"
                    />
                  </summary>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {alignmentInput("alignment", m.project_email_alignment())}
                    {numberFields()
                      .filter(
                        ({ key }) => key === "padding" || key === "radius",
                      )
                      .map(numberInput)}
                  </div>
                </details>
              </TabsContent>
            </Tabs>
            <div className="min-w-0 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto">
              <EmailPreview
                projectId={project.id}
                payload={payload}
                valid={valid}
              />
            </div>
          </div>
          {!valid ? (
            <p role="alert" className="text-destructive text-sm">
              {m.project_email_invalid()}
            </p>
          ) : null}
          {AsyncResult.isFailure(saveResult) ? (
            <p role="alert" className="text-destructive text-sm">
              {m.project_email_error()}
            </p>
          ) : null}
          <div className="bg-background/95 sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t py-3 backdrop-blur-sm">
            <p role="status" className="text-muted-foreground text-sm">
              {dirty
                ? m.project_email_unsaved()
                : saved
                  ? m.project_email_saved()
                  : m.project_email_up_to_date()}
            </p>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={saveResult.waiting}
                      aria-label={m.project_email_more_actions()}
                    />
                  }
                >
                  <MoreHorizontalIcon aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-auto min-w-56">
                  <DropdownMenuItem
                    disabled={saveResult.waiting}
                    onClick={() => updateContent({})}
                  >
                    {m.project_email_restore_content()}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={saveResult.waiting}
                    onClick={() =>
                      change(Struct.omit(settings, ["appearance"]))
                    }
                  >
                    {m.project_email_restore_appearance()}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={saveResult.waiting}
                    onClick={() => change({})}
                  >
                    {m.project_email_restore_all()}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="submit"
                disabled={!valid || !dirty || saveResult.waiting}
              >
                {m.project_email_save()}
              </Button>
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
};
