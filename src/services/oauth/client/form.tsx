import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorMessage, useAppForm } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
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
  scope: string[];
};

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

export function OAuthClientForm({
  client,
  onClose,
  onSaved,
}: {
  client?: OAuthClientAdmin;
  onClose: () => void;
  onSaved: (client: OAuthClientFormSaved) => void;
}) {
  const createOAuthClient = useAtomSet(createOAuthClientAtom, {
    mode: "promise",
  });
  const updateOAuthClient = useAtomSet(updateOAuthClientAtom, {
    mode: "promise",
  });
  const [error, setError] = useState("");
  const projectsResult = useAtomValue(projectsAtom);
  const projects = AsyncResult.match(projectsResult, {
    onInitial: () => [] as Project[],
    onFailure: () => [] as Project[],
    onSuccess: ({ value }) => Array.from(value),
  });
  const isEditing = Boolean(client);

  const form = useAppForm({
    defaultValues: {
      name: client?.name ?? "",
      projectId: client?.projectId ?? "",
      redirectUris: client?.redirectUris.join("\n") ?? "",
      scope: client?.scope
        ? parseList(client.scope.replaceAll(" ", "\n"))
        : defaultScope,
    } satisfies OAuthClientFormValues,
    onSubmit: async ({ value }) => {
      setError("");
      try {
        const saved = client
          ? await updateOAuthClient({
              params: { clientId: client.clientId },
              payload: valuesToPayload(value),
            })
          : await createOAuthClient({
              payload: valuesToCreatePayload(value),
            });
        toast.success(
          client
            ? m.oauth_client_updated_toast()
            : m.admin_client_created_toast(),
        );
        onSaved(saved);
        onClose();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : client
              ? m.oauth_client_update_error()
              : m.admin_error_create_client(),
        );
      }
    },
  });

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
            <form.AppField name="projectId">
              {(field) => (
                <field.SelectField
                  label={m.project()}
                  required={false}
                  options={[
                    { label: m.project_none(), value: "" },
                    ...projects.map((project) => ({
                      label: project.name,
                      value: project.id,
                    })),
                  ]}
                  description={m.oauth_client_project_description()}
                />
              )}
            </form.AppField>
            <form.AppField name="redirectUris">
              {(field) => (
                <field.TextAreaField
                  label={m.admin_field_redirect_uris()}
                  description={m.admin_field_redirect_uris_description()}
                  rows={4}
                />
              )}
            </form.AppField>
            <form.AppField name="scope">
              {(field) => (
                <field.MultiSelectField
                  label={m.admin_column_scopes()}
                  options={scopeOptions}
                  placeholder={m.oauth_client_scopes_placeholder()}
                  description={m.oauth_client_scopes_description()}
                />
              )}
            </form.AppField>
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
