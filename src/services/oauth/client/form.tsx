import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { useState } from "react";
import { toast } from "sonner";

import {
  MultiSelectField,
  SelectField,
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
import { AdminApiClient } from "@/lib/admin-api-client";
import { m } from "@/paraglide/messages";
import type { Project } from "@/services/projects/schema";

import {
  type OAuthClientAdmin,
  type OAuthClientCreated,
  type CreateOAuthClientPayload,
  type UpdateOAuthClientPayload,
} from "../schema";

export type OAuthClientFormSaved = OAuthClientAdmin | OAuthClientCreated;

type OAuthClientFormValues = {
  name: string;
  projectId: string;
  redirectUris: string;
  scope: readonly string[];
};

const oauthClientFormBuilder = FormBuilder.empty
  .addField("name", Schema.String)
  .addField("projectId", Schema.String)
  .addField("redirectUris", Schema.String)
  .addField("scope", Schema.Array(Schema.String));

const defaultScope = ["openid", "profile", "email"];

const scopeOptions = [
  { label: m.oauth_client_scope_openid(), value: "openid" },
  { label: m.oauth_client_scope_profile(), value: "profile" },
  { label: m.oauth_client_scope_email(), value: "email" },
  { label: m.oauth_client_scope_offline_access(), value: "offline_access" },
];

const createOAuthClientAtom = AdminApiClient.mutation(
  "oauthClients",
  "createOAuthClient",
);
const updateOAuthClientAtom = AdminApiClient.mutation(
  "oauthClients",
  "updateOAuthClient",
);
const projectsAtom = AdminApiClient.query("projects", "listProjects", {
  timeToLive: "1 minute",
  reactivityKeys: ["projects"],
});
const parseList = (value: string) =>
  value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const redirectUrisFromValue = (value: string): [string, ...string[]] => {
  const redirectUris = parseList(value);
  const firstRedirectUri = redirectUris[0];

  if (!firstRedirectUri) {
    throw new Error(m.admin_field_redirect_uris_description());
  }

  return [firstRedirectUri, ...redirectUris.slice(1)];
};

const valuesToPayload = (value: OAuthClientFormValues) => {
  return {
    name: value.name.trim() || undefined,
    projectId: value.projectId || null,
    redirectUris: redirectUrisFromValue(value.redirectUris),
    scope: value.scope.length ? value.scope.join(" ") : defaultScope.join(" "),
  } satisfies UpdateOAuthClientPayload;
};

const valuesToCreatePayload = (value: OAuthClientFormValues) => {
  return {
    ...valuesToPayload(value),
    scope: value.scope.length ? value.scope.join(" ") : defaultScope.join(" "),
  } satisfies CreateOAuthClientPayload;
};

const makeOAuthClientForm = (client?: OAuthClientAdmin) =>
  FormReact.make(oauthClientFormBuilder, {
    fields: {
      name: TextField,
      projectId: SelectField,
      redirectUris: TextAreaField,
      scope: MultiSelectField,
    },
    onSubmit: (_, { decoded: value, get }) =>
      client
        ? get.setResult(updateOAuthClientAtom, {
            params: { clientId: client.clientId },
            payload: valuesToPayload(value),
          })
        : get.setResult(createOAuthClientAtom, {
            payload: valuesToCreatePayload(value),
          }),
  });

export function OAuthClientForm({
  client,
  onClose,
  onSaved,
}: {
  client?: OAuthClientAdmin;
  onClose: () => void;
  onSaved: (client: OAuthClientFormSaved) => void;
}) {
  const projectsResult = useAtomValue(projectsAtom);
  const projects = AsyncResult.match(projectsResult, {
    onInitial: () => Array<Project>(),
    onFailure: () => Array<Project>(),
    onSuccess: ({ value }) => Array.from(value),
  });
  const isEditing = Boolean(client);

  const [form] = useState(() => makeOAuthClientForm(client));
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);
  useAtomSubscribe(form.submit, (result) => {
    if (!AsyncResult.isSuccess(result)) return;
    toast.success(
      client ? m.oauth_client_updated_toast() : m.admin_client_created_toast(),
    );
    onSaved(result.value);
    onClose();
  });
  const defaultValues = {
    name: client?.name ?? "",
    projectId: client?.projectId ?? "",
    redirectUris: client?.redirectUris.join("\n") ?? "",
    scope: client?.scope
      ? parseList(client.scope.replaceAll(" ", "\n"))
      : defaultScope,
  } satisfies OAuthClientFormValues;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? m.oauth_client_edit_title()
              : m.admin_create_client_title()}
          </DialogTitle>
          <DialogDescription>
            {client
              ? m.oauth_client_edit_description({ id: client.clientId })
              : m.admin_create_client_description()}
          </DialogDescription>
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
            <form.projectId
              label={m.project()}
              options={[
                { label: m.project_none(), value: "" },
                ...projects.map((project) => ({
                  label: project.name,
                  value: project.id,
                })),
              ]}
              description={m.oauth_client_project_description()}
            />
            <form.redirectUris
              label={m.admin_field_redirect_uris()}
              description={m.admin_field_redirect_uris_description()}
              rows={4}
            />
            <form.scope
              label={m.admin_column_scopes()}
              options={scopeOptions}
              placeholder={m.oauth_client_scopes_placeholder()}
              description={m.oauth_client_scopes_description()}
            />
            <SubmitError result={submitResult} />
            <SubmitButton form={form}>{m.form_submit()}</SubmitButton>
          </form>
        </form.Initialize>
      </DialogContent>
    </Dialog>
  );
}
