import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { Schema, Struct } from "effect";
import { useEffect, useMemo, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { MoreHorizontalIcon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { m } from "@/paraglide/messages";
import { assetUrl } from "@/lib/assets";
import { authBaseUrl } from "@/services/auth/client";
import { defaultAuthEmailContent } from "@/services/auth-emails/content";
import {
  AuthEmailKind,
  AuthEmailSettings,
  AuthEmailDraftSettings,
  type AuthEmailContent,
  type AuthEmailPreviewPayload,
  type AuthEmailPreview,
} from "@/services/auth-emails/schema";
import {
  resetEmailAppearance,
  resetEmailTypography,
} from "@/services/auth-emails/layout";
import { emailDefaultColors } from "@/services/auth-emails/typography";
import {
  EmailChoice,
  EmailColorField,
  EmailLogoPlacement,
  EmailSectionEditor,
} from "./email-layout";
import { EmailBodyEditor } from "./email-body";
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

const colorFields = () =>
  [
    { key: "background", label: m.project_email_background() },
    { key: "card", label: m.project_email_card() },
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
  const [draft, setDraft] = useState(
    valid ? payload : { ...payload, settings: {} },
  );
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
  const [lastPreview, setLastPreview] = useState<AuthEmailPreview | null>(null);
  const currentPreview = AsyncResult.getOrElse(result, () => null);
  if (currentPreview && currentPreview !== lastPreview)
    setLastPreview(currentPreview);
  const preview = currentPreview ?? lastPreview;
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

const sameEmailSettings = Schema.toEquivalence(AuthEmailDraftSettings);

export const ProjectEmailEditor = ({ project }: { project: Project }) => {
  const [settings, setSettings] = useState<AuthEmailSettings>(
    () => project.data.email ?? {},
  );
  const [kind, setKind] = useState<AuthEmailKind>("email-verification");
  const [locale, setLocale] = useState<"en" | "fr">("en");
  const [section, setSection] = useState<"header" | "body" | "footer">("body");
  const [saved, setSaved] = useState(false);
  const [savedSettings, setSavedSettings] = useState<AuthEmailSettings>(
    () => project.data.email ?? {},
  );
  const [tested, setTested] = useState(false);
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
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
  const previewValid = Schema.is(AuthEmailDraftSettings)(settings);
  const selectedMissing = [
    settings.layout?.header,
    settings.layout?.footer,
  ].some((section) =>
    section?.blocks.some((block) =>
      block.type === "text"
        ? !block.text[locale].trim()
        : block.type === "link"
          ? !block.translations[locale].label.trim() ||
            !block.translations[locale].url
          : false,
    ),
  );
  const dirty = !sameEmailSettings(settings, savedSettings);
  useBlocker({
    shouldBlockFn: ({ current, next }) =>
      dirty &&
      current.pathname !== next.pathname &&
      !window.confirm(m.project_email_confirm_leave()),
    enableBeforeUnload: dirty,
  });
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
    <EmailChoice
      label={label}
      value={
        settings.appearance?.[key] ?? settings.appearance?.alignment ?? "left"
      }
      options={[
        { value: "left", label: m.project_email_left() },
        { value: "center", label: m.project_email_center() },
        { value: "right", label: m.project_email_right() },
      ]}
      onChange={(value) => {
        if (value === "left" || value === "center" || value === "right")
          change({
            ...settings,
            appearance: { ...settings.appearance, [key]: value },
          });
      }}
    />
  );
  const colorInput = ({
    key,
    label,
  }: ReturnType<typeof colorFields>[number]) => (
    <EmailColorField
      key={key}
      label={label}
      value={settings.appearance?.[key]}
      fallback={emailDefaultColors[key]}
      onChange={(value) =>
        change({
          ...settings,
          appearance: value
            ? { ...settings.appearance, [key]: value }
            : Struct.omit(settings.appearance ?? {}, [key]),
        })
      }
    />
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
            <EmailChoice
              label={m.project_email_kind()}
              value={kind}
              options={emailKinds()}
              onChange={(value) => {
                if (Schema.is(AuthEmailKind)(value)) {
                  setKind(value);
                  setTested(false);
                }
              }}
            />
            <EmailChoice
              label={m.project_email_language()}
              value={locale}
              options={[
                { value: "en", label: m.project_email_english() },
                { value: "fr", label: m.project_email_french() },
              ]}
              onChange={(value) => {
                if (value === "en" || value === "fr") {
                  setLocale(value);
                  setTested(false);
                }
              }}
            />
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
            <div className="min-w-0 space-y-4">
              <details
                className="rounded-xl border p-4"
                aria-label={m.project_email_email_appearance()}
              >
                <summary className="cursor-pointer text-sm font-medium">
                  {m.project_email_email_appearance()}
                </summary>
                <div className="space-y-4 pt-4">
                  <p className="text-muted-foreground text-xs">
                    {m.project_email_shared_help()}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {colorFields()
                      .filter(({ key }) => key === "background")
                      .map(colorInput)}
                  </div>
                  <details className="border-t pt-3">
                    <summary className="cursor-pointer text-sm">
                      {m.project_email_logo_style()}
                    </summary>
                    <div className="space-y-3 pt-3">
                      <EmailLogoPlacement
                        settings={settings}
                        logo={logo ?? undefined}
                        onChange={change}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        {numberFields()
                          .filter(({ key }) => key.startsWith("logo"))
                          .map(numberInput)}
                        {alignmentInput(
                          "logoAlignment",
                          m.project_email_logo_alignment(),
                        )}
                      </div>
                    </div>
                  </details>
                </div>
              </details>
              <Tabs
                value={section}
                onValueChange={(value) => {
                  if (
                    value === "header" ||
                    value === "body" ||
                    value === "footer"
                  )
                    setSection(value);
                }}
                className="min-w-0 gap-4"
              >
                <TabsList
                  className="w-full"
                  aria-label={m.project_email_edit_sections()}
                >
                  <TabsTrigger value="header" type="button">
                    {m.project_email_section_header()}
                  </TabsTrigger>
                  <TabsTrigger value="body" type="button">
                    {m.project_email_section_body()}
                  </TabsTrigger>
                  <TabsTrigger value="footer" type="button">
                    {m.project_email_section_footer()}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="body">
                  <EmailBodyEditor
                    key={`${kind}-${locale}`}
                    settings={settings}
                    content={content}
                    defaults={defaults}
                    kind={kind}
                    locale={locale}
                    brandName={project.name}
                    onChange={change}
                    onContentChange={updateContent}
                    cardAppearance={
                      <>
                        <p className="text-muted-foreground text-xs">
                          {m.project_email_appearance_scope()}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {colorFields()
                            .filter(({ key }) => key !== "background")
                            .map(colorInput)}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {alignmentInput(
                            "alignment",
                            m.project_email_alignment(),
                          )}
                          {numberFields()
                            .filter(
                              ({ key }) =>
                                key === "padding" || key === "radius",
                            )
                            .map(numberInput)}
                        </div>
                      </>
                    }
                  />
                </TabsContent>
                {(["header", "footer"] as const).map((name) => (
                  <TabsContent key={name} value={name} className="space-y-3">
                    <p className="text-muted-foreground text-xs">
                      {m.project_email_section_scope()}
                    </p>
                    <EmailSectionEditor
                      name={name}
                      settings={settings}
                      locale={locale}
                      logo={logo ?? undefined}
                      activeBlock={activeBlock}
                      onSelectBlock={setActiveBlock}
                      onMove={setSection}
                      onChange={change}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </div>
            <div className="min-w-0 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto">
              <EmailPreview
                projectId={project.id}
                payload={payload}
                valid={previewValid}
              />
              {selectedMissing ? (
                <p role="status" className="mt-2 text-sm">
                  {m.project_email_selected_missing()}
                </p>
              ) : null}
            </div>
          </div>
          {!valid ? (
            <p role="alert" className="text-destructive text-sm">
              {previewValid
                ? m.project_email_missing_translation()
                : m.project_email_invalid()}
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
                    onClick={() => change(resetEmailAppearance(settings))}
                  >
                    {m.project_email_restore_appearance()}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={saveResult.waiting}
                    onClick={() => change(resetEmailTypography(settings))}
                  >
                    {m.project_email_restore_typography()}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={saveResult.waiting}
                    onClick={() => {
                      if (window.confirm(m.project_email_confirm_reset()))
                        change({});
                    }}
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
