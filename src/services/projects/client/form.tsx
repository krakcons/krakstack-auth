import { useAtomSet } from "@effect/atom-react";
import { Schema } from "effect";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ErrorMessage, useAppForm } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { m } from "@/paraglide/messages";
import { AdminApiClient } from "@/lib/admin-api-client";
import { authBaseUrl } from "@/services/auth/client";
import { ProjectData, type Project } from "@/services/projects/schema";

const createProjectAtom = AdminApiClient.mutation("projects", "createProject");
const updateProjectAtom = AdminApiClient.mutation("projects", "updateProject");
const presignLogoUploadAtom = AdminApiClient.mutation(
  "projects",
  "presignProjectLogoUpload",
);

type ProjectFormValues = {
  name: string;
  logo: File | string | null;
  themeCss: string;
  emailPassword: boolean;
  google: boolean;
  signUp: boolean;
  signUpName: boolean;
};

const isFile = (value: unknown): value is File => value instanceof File;

const assetUrl = (value: string | null | undefined) => {
  const url = value?.trim();
  if (!url) return null;
  if (!url.startsWith("/api/assets/")) return url;
  if (!authBaseUrl?.trim()) return url;

  return new URL(url, authBaseUrl).toString();
};

const valuesToData = (value: ProjectFormValues) =>
  Schema.decodeUnknownSync(ProjectData)({
    branding: { themeCss: value.themeCss.trim() || undefined },
    authOptions: {
      emailPassword: value.emailPassword,
      google: value.google,
      signUp: value.signUp,
      signUpName: value.signUpName,
    },
  });

export function ProjectForm({
  project,
  onClose,
  onSaved,
}: {
  project?: Project;
  onClose: () => void;
  onSaved: (project: Project) => void;
}) {
  const createProject = useAtomSet(createProjectAtom, { mode: "promise" });
  const updateProject = useAtomSet(updateProjectAtom, { mode: "promise" });
  const presignLogoUpload = useAtomSet(presignLogoUploadAtom, {
    mode: "promise",
  });
  const [error, setError] = useState("");
  const form = useAppForm({
    defaultValues: {
      name: project?.name ?? "",
      logo: assetUrl(project?.logo),
      themeCss: project?.data.branding?.themeCss ?? "",
      emailPassword: project?.data.authOptions?.emailPassword ?? true,
      google: project?.data.authOptions?.google ?? true,
      signUp: project?.data.authOptions?.signUp ?? true,
      signUpName: project?.data.authOptions?.signUpName ?? true,
    } satisfies ProjectFormValues,
    onSubmit: async ({ value }) => {
      setError("");
      try {
        const logoFile = isFile(value.logo) ? value.logo : null;
        const logo = logoFile
          ? await (async () => {
              const presigned = await presignLogoUpload({
                payload: {
                  fileName: logoFile.name,
                  contentType: logoFile.type,
                },
              });
              const uploadResponse = await fetch(presigned.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": logoFile.type },
                body: logoFile,
              });

              if (!uploadResponse.ok) throw new Error(m.project_save_error());
              return presigned.url;
            })()
          : value.logo;
        const data = valuesToData(value);
        const saved = project
          ? await updateProject({
              params: { id: project.id },
              payload: {
                name: value.name.trim(),
                logo,
                data,
              },
              reactivityKeys: ["projects"],
            })
          : await createProject({
              payload: {
                name: value.name.trim(),
                logo,
                data,
              },
              reactivityKeys: ["projects"],
            });
        toast.success(
          project ? m.project_updated_toast() : m.project_created_toast(),
        );
        onSaved(saved);
        onClose();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : m.project_save_error(),
        );
      }
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {project ? m.project_edit_title() : m.project_create_title()}
          </DialogTitle>
          <DialogDescription>{m.project_form_description()}</DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
          >
            <form.AppField name="name">
              {(field) => (
                <field.TextField label={m.admin_field_display_name()} />
              )}
            </form.AppField>
            <form.AppField name="logo">
              {(field) => (
                <field.ImageField
                  label={m.oauth_client_logo_url()}
                  size={{
                    width: 96,
                    height: 96,
                    suggestedWidth: 512,
                    suggestedHeight: 512,
                  }}
                />
              )}
            </form.AppField>
            <form.AppField name="themeCss">
              {(field) => (
                <field.TextAreaField
                  label={m.oauth_client_theme_css()}
                  description={m.oauth_client_theme_css_description()}
                  rows={12}
                  spellCheck={false}
                />
              )}
            </form.AppField>
            <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-4">
              <form.AppField name="emailPassword">
                {(field) => (
                  <field.CheckboxField
                    label={m.oauth_client_auth_email_password()}
                  />
                )}
              </form.AppField>
              <form.AppField name="google">
                {(field) => (
                  <field.CheckboxField label={m.oauth_client_auth_google()} />
                )}
              </form.AppField>
              <form.AppField name="signUp">
                {(field) => (
                  <field.CheckboxField label={m.oauth_client_auth_sign_up()} />
                )}
              </form.AppField>
              <form.AppField name="signUpName">
                {(field) => (
                  <field.CheckboxField
                    label={m.oauth_client_auth_sign_up_name()}
                  />
                )}
              </form.AppField>
            </div>
            <form.FormError />
            {error ? <ErrorMessage text={error} /> : null}
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  disabled={isSubmitting}
                  type="submit"
                  className="self-start"
                >
                  {isSubmitting ? (
                    <Loader2
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : null}
                  {m.form_submit()}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
