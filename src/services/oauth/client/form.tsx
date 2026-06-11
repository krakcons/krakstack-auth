import { useAtomSet } from "@effect/atom-react";
import { Schema } from "effect";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorMessage, useAppForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiClient } from "@/lib/api-client";
import { m } from "@/paraglide/messages";

import {
  OAuthClientMetadata,
  type OAuthClientAdmin,
  type OAuthClientCreated,
  type CreateOAuthClientPayload,
  type UpdateOAuthClientPayload,
} from "../schema";

export type OAuthClientFormSaved = OAuthClientAdmin | OAuthClientCreated;

type OAuthClientFormValues = {
  name: string;
  redirectUris: string;
  scope: string[];
  icon: File | string | null;
  themeCss: string;
  emailPassword: boolean;
  google: boolean;
  signUp: boolean;
  signUpName: boolean;
};

const defaultScope = ["openid", "profile", "email"];

const scopeOptions = [
  { label: m.oauth_client_scope_openid(), value: "openid" },
  { label: m.oauth_client_scope_profile(), value: "profile" },
  { label: m.oauth_client_scope_email(), value: "email" },
  { label: m.oauth_client_scope_offline_access(), value: "offline_access" },
];

const isFile = (value: unknown): value is File => value instanceof File;

const createOAuthClientAtom = ApiClient.mutation(
  "oauthClients",
  "createOAuthClient",
);
const updateOAuthClientAtom = ApiClient.mutation(
  "oauthClients",
  "updateOAuthClient",
);
const presignLogoUploadAtom = ApiClient.mutation(
  "oauthClients",
  "presignOAuthClientLogoUpload",
);

const parseList = (value: string) =>
  value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const valuesToPayload = (value: OAuthClientFormValues, icon: string | null) => {
  const metadata = Schema.decodeUnknownSync(OAuthClientMetadata)({
    branding: {
      themeCss: value.themeCss.trim() || undefined,
    },
    authOptions: {
      emailPassword: value.emailPassword,
      google: value.google,
      signUp: value.signUp,
      signUpName: value.signUpName,
    },
  });

  return {
    name: value.name.trim() || undefined,
    icon,
    scope: value.scope.length ? value.scope.join(" ") : defaultScope.join(" "),
    metadata,
  } satisfies UpdateOAuthClientPayload;
};

const valuesToCreatePayload = (
  value: OAuthClientFormValues,
  icon: string | null,
) => {
  const redirectUris = parseList(value.redirectUris);
  const firstRedirectUri = redirectUris[0];

  if (!firstRedirectUri) {
    throw new Error(m.admin_field_redirect_uris_description());
  }

  return {
    ...valuesToPayload(value, icon),
    redirectUris: [firstRedirectUri, ...redirectUris.slice(1)],
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
  const presignLogoUpload = useAtomSet(presignLogoUploadAtom, {
    mode: "promise",
  });
  const [error, setError] = useState("");
  const isEditing = Boolean(client);
  const form = useAppForm({
    defaultValues: {
      name: client?.name ?? "",
      redirectUris: client?.redirectUris.join("\n") ?? "",
      scope: client?.scope
        ? parseList(client.scope.replaceAll(" ", "\n"))
        : defaultScope,
      icon: client?.icon ?? null,
      themeCss: client?.metadata.branding?.themeCss ?? "",
      emailPassword: client?.metadata.authOptions?.emailPassword ?? true,
      google: client?.metadata.authOptions?.google ?? true,
      signUp: client?.metadata.authOptions?.signUp ?? true,
      signUpName: client?.metadata.authOptions?.signUpName ?? true,
    } satisfies OAuthClientFormValues,
    onSubmit: async ({ value }) => {
      setError("");
      try {
        const iconFile = isFile(value.icon) ? value.icon : null;
        const icon = iconFile
          ? await (async () => {
              const presigned = await presignLogoUpload({
                payload: {
                  fileName: iconFile.name,
                  contentType: iconFile.type,
                },
              });
              const uploadResponse = await fetch(presigned.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": iconFile.type },
                body: iconFile,
              });

              if (!uploadResponse.ok) {
                throw new Error(m.oauth_client_update_error());
              }

              return presigned.url;
            })()
          : value.icon;
        const saved = client
          ? await updateOAuthClient({
              params: { clientId: client.clientId },
              payload: valuesToPayload(value, icon),
            })
          : await createOAuthClient({
              payload: valuesToCreatePayload(value, icon),
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
            {!isEditing ? (
              <>
                <form.AppField name="redirectUris">
                  {(field) => (
                    <field.TextAreaField
                      label={m.admin_field_redirect_uris()}
                      description={m.admin_field_redirect_uris_description()}
                      rows={4}
                    />
                  )}
                </form.AppField>
              </>
            ) : null}
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
            <form.AppField name="icon">
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
