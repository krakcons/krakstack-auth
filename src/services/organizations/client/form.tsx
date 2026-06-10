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

import { CreateOrganizationPayload, type Organization } from "../schema";

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

const createOrganizationAtom = ApiClient.mutation(
  "organizations",
  "createOrganization",
);
const updateOrganizationAtom = ApiClient.mutation(
  "organizations",
  "updateOrganization",
);
const presignLogoUploadAtom = ApiClient.mutation(
  "organizations",
  "presignOrganizationLogoUpload",
);

const valuesToPayload = (value: OrganizationFormValues, logo: string | null) =>
  Schema.decodeUnknownSync(CreateOrganizationPayload)({
    name: value.name.trim(),
    slug: slugify(value.slug || value.name),
    logo: logo ?? undefined,
  });

export function OrganizationForm({
  organization,
  onClose,
  onSaved,
}: {
  organization?: Organization;
  onClose: () => void;
  onSaved: (organization: Organization) => void;
}) {
  const createOrganization = useAtomSet(createOrganizationAtom, {
    mode: "promise",
  });
  const updateOrganization = useAtomSet(updateOrganizationAtom, {
    mode: "promise",
  });
  const presignLogoUpload = useAtomSet(presignLogoUploadAtom, {
    mode: "promise",
  });
  const [error, setError] = useState("");
  const isEditing = Boolean(organization);
  const form = useAppForm({
    defaultValues: {
      name: organization?.name ?? "",
      slug: organization?.slug ?? "",
      logo: organization?.logo ?? null,
    } satisfies OrganizationFormValues,
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

              if (!uploadResponse.ok) {
                throw new Error(m.organization_update_error());
              }

              return presigned.url;
            })()
          : value.logo;
        const payload = valuesToPayload(value, logo);
        const saved = organization
          ? await updateOrganization({
              params: { id: organization.id },
              payload,
            })
          : await createOrganization({ payload });

        toast.success(
          organization
            ? m.organization_updated_toast()
            : m.organization_created_toast(),
        );
        onSaved(saved);
        onClose();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : organization
              ? m.organization_update_error()
              : m.organization_create_error(),
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
              ? m.organization_edit_title()
              : m.organization_create_title()}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? m.admin_organization_edit_description({
                  name: organization?.name ?? "",
                })
              : m.organization_create_description()}
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
              {(field) => <field.TextField label={m.field_name()} autoFocus />}
            </form.AppField>
            <form.AppField name="slug">
              {(field) => (
                <field.TextField
                  label={m.organization_slug()}
                  description={m.organization_slug_description()}
                />
              )}
            </form.AppField>
            <form.AppField name="logo">
              {(field) => (
                <field.ImageField
                  label={m.organization_field_logo_url()}
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
