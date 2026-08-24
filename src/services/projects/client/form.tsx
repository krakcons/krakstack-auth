import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { Effect, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { useState } from "react";
import { toast } from "sonner";

import {
  CheckboxField,
  ImageField,
  SubmitButton,
  SubmitError,
  TextAreaField,
  TextField,
} from "@krak-stack/registry/effect-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { m } from "@/paraglide/messages";
import { AdminApiClient } from "@/lib/admin-api-client";
import { assetPath, assetUrl } from "@/lib/assets";
import { authBaseUrl } from "@/services/auth/client";
import { ProjectData, type Project } from "@/services/projects/schema";

const createProjectAtom = AdminApiClient.mutation("projects", "createProject");
const updateProjectAtom = AdminApiClient.mutation("projects", "updateProject");
const uploadLogoAtom = AdminApiClient.mutation("projects", "uploadProjectLogo");

type ProjectFormValues = {
  name: string;
  logo: File | string | null | undefined;
  themeCss: string;
  emailPassword: boolean;
  emailOtp: boolean;
  google: boolean;
};

const projectFormBuilder = FormBuilder.empty
  .addField("name", Schema.String)
  .addField(
    "logo",
    Schema.Union([
      Schema.String,
      Schema.instanceOf(File),
      Schema.Null,
      Schema.Undefined,
    ]),
  )
  .addField("themeCss", Schema.String)
  .addField("emailPassword", Schema.Boolean)
  .addField("emailOtp", Schema.Boolean)
  .addField("google", Schema.Boolean);

const isFile = (value: typeof Schema.Unknown.Type): value is File =>
  value instanceof File;

const valuesToData = (value: ProjectFormValues) =>
  Schema.decodeUnknownSync(ProjectData)({
    branding: { themeCss: value.themeCss.trim() || undefined },
    authOptions: {
      emailPassword: value.emailPassword,
      emailOtp: value.emailOtp,
      google: value.google,
    },
  });

const makeProjectForm = (project?: Project) =>
  FormReact.make(projectFormBuilder, {
    fields: {
      name: TextField,
      logo: ImageField,
      themeCss: TextAreaField,
      emailPassword: CheckboxField,
      emailOtp: CheckboxField,
      google: CheckboxField,
    },
    onSubmit: (_, { decoded: value, get }) => {
      let logo = assetPath(isFile(value.logo) ? null : value.logo);
      const save = (uploadedLogo?: string) => {
        if (uploadedLogo) logo = assetPath(uploadedLogo);
        const data = valuesToData(value);
        return project
          ? get.setResult(updateProjectAtom, {
              params: { id: project.id },
              payload: { name: value.name.trim(), logo, data },
              reactivityKeys: ["projects"],
            })
          : get.setResult(createProjectAtom, {
              payload: { name: value.name.trim(), logo, data },
              reactivityKeys: ["projects"],
            });
      };

      if (!isFile(value.logo)) return save();

      const payload = new FormData();
      payload.append("file", value.logo);
      return get
        .setResult(uploadLogoAtom, { payload })
        .pipe(Effect.flatMap((uploaded) => save(uploaded.url)));
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
  const [form] = useState(() => makeProjectForm(project));
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);
  useAtomSubscribe(form.submit, (result) => {
    if (!AsyncResult.isSuccess(result)) return;
    toast.success(
      project ? m.project_updated_toast() : m.project_created_toast(),
    );
    onSaved(result.value);
    onClose();
  });
  const defaultValues = {
    name: project?.name ?? "",
    logo: assetUrl(project?.logo, authBaseUrl),
    themeCss: project?.data.branding?.themeCss ?? "",
    emailPassword: project?.data.authOptions?.emailPassword ?? true,
    emailOtp: project?.data.authOptions?.emailOtp ?? true,
    google: project?.data.authOptions?.google ?? true,
  } satisfies ProjectFormValues;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {project ? m.project_edit_title() : m.project_create_title()}
          </DialogTitle>
          <DialogDescription>{m.project_form_description()}</DialogDescription>
        </DialogHeader>
        <form.Initialize defaultValues={defaultValues}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              submit();
            }}
          >
            <form.name label={m.admin_field_display_name()} />
            <form.logo
              label={m.oauth_client_logo_url()}
              size={{
                width: 96,
                height: 96,
                suggestedWidth: 512,
                suggestedHeight: 512,
              }}
            />
            <form.themeCss
              label={m.oauth_client_theme_css()}
              description={m.oauth_client_theme_css_description()}
              rows={12}
              spellCheck={false}
            />
            <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-3">
              <form.emailPassword
                label={m.oauth_client_auth_email_password()}
              />
              <form.emailOtp label={m.oauth_client_auth_email_otp()} />
              <form.google label={m.oauth_client_auth_google()} />
            </div>
            <SubmitError result={submitResult} />
            <SubmitButton form={form}>{m.form_submit()}</SubmitButton>
          </form>
        </form.Initialize>
      </DialogContent>
    </Dialog>
  );
}
