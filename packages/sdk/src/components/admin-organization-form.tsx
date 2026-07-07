import { useAtomSet } from "@effect/atom-react";
import { Schema } from "effect";
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
import { ApiClient } from "@/lib/api-client";
import { assetPath, assetUrl } from "@/lib/assets";
import { authBaseUrl } from "@/services/auth/client";
import {
  CreateOrganizationPayload,
  type Organization,
} from "@/services/organizations/schema";

import { type KrakstackAuthLocale, useKrakstackAuth } from "./auth-provider";

const defaultMessages = {
  en: {
    admin_organization_edit_description:
      "Update {name}'s canonical organization details.",
    field_name: "Name",
    form_submit: "Save",
    organization_create_description:
      "Create an organization that can be used for Better Auth membership.",
    organization_create_error: "Unable to create organization.",
    organization_create_title: "Create organization",
    organization_created_toast: "Organization created.",
    organization_edit_title: "Edit organization",
    organization_field_logo_url: "Logo",
    organization_slug: "Slug",
    organization_slug_description: "Leave blank to generate one from the name.",
    organization_update_error: "Unable to update organization.",
    organization_updated_toast: "Organization updated.",
  },
  fr: {
    admin_organization_edit_description:
      "Mettez à jour les détails canoniques de l'organisation {name}.",
    field_name: "Nom",
    form_submit: "Enregistrer",
    organization_create_description:
      "Créez une organisation utilisable pour les adhésions Better Auth.",
    organization_create_error: "Impossible de créer l'organisation.",
    organization_create_title: "Créer une organisation",
    organization_created_toast: "Organisation créée.",
    organization_edit_title: "Modifier l'organisation",
    organization_field_logo_url: "Logo",
    organization_slug: "Slug",
    organization_slug_description:
      "Laissez vide pour en générer un à partir du nom.",
    organization_update_error: "Impossible de mettre à jour l'organisation.",
    organization_updated_toast: "Organisation mise à jour.",
  },
} as const;

const labels = (locale: KrakstackAuthLocale) => ({
  ...defaultMessages[locale],
});

const text = (value: string, params?: Record<string, string>) =>
  Object.entries(params ?? {}).reduce(
    (current, [key, replacement]) => current.replace(`{${key}}`, replacement),
    value,
  );

type OrganizationFormValues = {
  name: string;
  slug: string;
  logo: File | string | null;
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isFile = (value: unknown): value is File => value instanceof File;

const createOrganizationAtom = AdminApiClient.mutation(
  "admin",
  "createOrganization",
);
const updateOrganizationAtom = AdminApiClient.mutation(
  "admin",
  "updateOrganization",
);
const uploadLogoAtom = ApiClient.mutation(
  "organizations",
  "uploadOrganizationLogo",
);

const valuesToPayload = (value: OrganizationFormValues, logo: string | null) =>
  Schema.decodeUnknownSync(CreateOrganizationPayload)({
    name: value.name.trim(),
    slug: slugify(value.slug || value.name),
    logo: logo ?? undefined,
  });

export function AdminOrganizationForm({
  organization,
  onClose,
  onSaved,
}: {
  organization?: Organization;
  onClose: () => void;
  onSaved: (organization: Organization) => void;
}) {
  const auth = useKrakstackAuth();
  const m = labels(auth?.locale ?? "en");
  const createOrganization = useAtomSet(createOrganizationAtom, {
    mode: "promise",
  });
  const updateOrganization = useAtomSet(updateOrganizationAtom, {
    mode: "promise",
  });
  const uploadLogo = useAtomSet(uploadLogoAtom, {
    mode: "promise",
  });
  const [error, setError] = useState("");
  const isEditing = Boolean(organization);
  const form = useAppForm({
    defaultValues: {
      name: organization?.name ?? "",
      slug: organization?.slug ?? "",
      logo: assetUrl(organization?.logo, authBaseUrl),
    } satisfies OrganizationFormValues,
    onSubmit: async ({ value }) => {
      setError("");
      try {
        const logoFile = isFile(value.logo) ? value.logo : null;
        const logo = logoFile
          ? await (async () => {
              const payload = new FormData();
              payload.append("file", logoFile);

              return assetPath((await uploadLogo({ payload })).url);
            })()
          : assetPath(value.logo);
        const payload = valuesToPayload(value, logo);
        const saved = organization
          ? await updateOrganization({
              params: { id: organization.id },
              payload,
            })
          : await createOrganization({ payload });

        toast.success(
          organization
            ? m.organization_updated_toast
            : m.organization_created_toast,
        );
        onSaved(saved);
        onClose();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : organization
              ? m.organization_update_error
              : m.organization_create_error,
        );
      }
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? m.organization_edit_title
              : m.organization_create_title}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? text(m.admin_organization_edit_description, {
                  name: organization?.name ?? "",
                })
              : m.organization_create_description}
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
              {(field) => <field.TextField label={m.field_name} autoFocus />}
            </form.AppField>
            <form.AppField name="slug">
              {(field) => (
                <field.TextField
                  label={m.organization_slug}
                  description={m.organization_slug_description}
                />
              )}
            </form.AppField>
            <form.AppField name="logo">
              {(field) => (
                <field.ImageField
                  label={m.organization_field_logo_url}
                  size={{
                    width: 96,
                    height: 96,
                    suggestedWidth: 512,
                    suggestedHeight: 512,
                  }}
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
                  {m.form_submit}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
