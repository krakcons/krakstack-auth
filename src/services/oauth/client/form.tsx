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
import { m } from "@/paraglide/messages";

import {
  OAuthClientMetadata,
  type OAuthClientAdmin,
  type UpdateOAuthClientPayload,
} from "../schema";

type OAuthClientFormValues = {
  name: string;
  icon: string;
  themeCss: string;
  emailPassword: boolean;
  google: boolean;
  signUp: boolean;
  signUpName: boolean;
};

const updateOAuthClient = async (
  clientId: string,
  payload: UpdateOAuthClientPayload,
) => {
  const response = await fetch(
    `/api/oauth/clients/${encodeURIComponent(clientId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(m.oauth_client_update_error());
  }

  return (await response.json()) as OAuthClientAdmin;
};

const valuesToPayload = (value: OAuthClientFormValues) => {
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
    icon: value.icon.trim() || null,
    metadata,
  } satisfies UpdateOAuthClientPayload;
};

export function OAuthClientForm({
  client,
  onClose,
  onSaved,
}: {
  client: OAuthClientAdmin;
  onClose: () => void;
  onSaved: (client: OAuthClientAdmin) => void;
}) {
  const [error, setError] = useState("");
  const form = useAppForm({
    defaultValues: {
      name: client.name ?? "",
      icon: client.icon ?? "",
      themeCss: client.metadata.branding?.themeCss ?? "",
      emailPassword: client.metadata.authOptions?.emailPassword ?? true,
      google: client.metadata.authOptions?.google ?? true,
      signUp: client.metadata.authOptions?.signUp ?? true,
      signUpName: client.metadata.authOptions?.signUpName ?? true,
    } satisfies OAuthClientFormValues,
    onSubmit: async ({ value }) => {
      setError("");
      try {
        const updated = await updateOAuthClient(
          client.clientId,
          valuesToPayload(value),
        );
        toast.success(m.oauth_client_updated_toast());
        onSaved(updated);
        onClose();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : m.oauth_client_update_error(),
        );
      }
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{m.oauth_client_edit_title()}</DialogTitle>
          <DialogDescription>
            {m.oauth_client_edit_description({ id: client.clientId })}
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
            <form.AppField name="icon">
              {(field) => (
                <field.TextField
                  label={m.oauth_client_logo_url()}
                  type="url"
                  description={m.oauth_client_logo_url_description()}
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
