import { useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useState } from "react";
import { toast } from "sonner";

import {
  ImageField,
  SingleSearchableSelectField,
  SubmitButton,
  SubmitError,
  TextField,
} from "@krak-stack/registry/effect-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminCreateOrganizationPayload,
  type AdminOrganization,
} from "../admin/schema.js";

import { authClientApi, authHttpClient } from "./auth-client-api.js";
import { type KrakstackAuthLocale, useKrakstackAuth } from "./auth-provider.js";
import { assetPath, assetUrl } from "./utils.js";

const defaultMessages = {
  en: {
    admin_organization_edit_description:
      "Update {name}'s canonical organization details.",
    field_name: "Name",
    form_submit: "Save",
    organization_create_description:
      "Create an organization that can be used for authentication membership.",
    organization_create_error: "Unable to create organization.",
    organization_create_title: "Create organization",
    organization_created_toast: "Organization created.",
    organization_edit_title: "Edit organization",
    organization_field_logo_url: "Logo",
    organization_parent: "Parent organization",
    organization_parent_description:
      "Optionally group this organization under another organization.",
    organization_parent_empty: "No organizations found.",
    organization_parent_none: "No parent organization",
    organization_parent_search: "Search organizations...",
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
      "Créez une organisation utilisable pour les adhésions d'authentification.",
    organization_create_error: "Impossible de créer l'organisation.",
    organization_create_title: "Créer une organisation",
    organization_created_toast: "Organisation créée.",
    organization_edit_title: "Modifier l'organisation",
    organization_field_logo_url: "Logo",
    organization_parent: "Organisation parente",
    organization_parent_description:
      "Regroupez facultativement cette organisation sous une autre organisation.",
    organization_parent_empty: "Aucune organisation trouvée.",
    organization_parent_none: "Aucune organisation parente",
    organization_parent_search: "Rechercher des organisations...",
    organization_slug: "Slug",
    organization_slug_description:
      "Laissez vide pour en générer un à partir du nom.",
    organization_update_error: "Impossible de mettre à jour l'organisation.",
    organization_updated_toast: "Organisation mise à jour.",
  },
} as const;

const labels = (locale: KrakstackAuthLocale) => defaultMessages[locale];

const text = (value: string, params?: Record<string, string>) =>
  Object.entries(params ?? {}).reduce(
    (current, [key, replacement]) => current.replace(`{${key}}`, replacement),
    value,
  );

const noParentOrganization = "__none__";

const organizationOptionsAtom = Atom.family((baseUrl?: string | undefined) =>
  authClientApi(baseUrl).query("admin", "listOrganizations", {
    query: { page: 0, pageSize: 100 },
    timeToLive: "1 minute",
    reactivityKeys: ["organizations"],
  }),
);
const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const organizationFormBuilder = FormBuilder.empty
  .addField("name", Schema.NonEmptyString)
  .addField("slug", Schema.String)
  .addField(
    "logo",
    Schema.UndefinedOr(
      Schema.NullOr(Schema.Union([Schema.String, Schema.instanceOf(File)])),
    ),
  )
  .addField("parentId", Schema.String);

type OrganizationFormResource = {
  baseUrl: string | undefined;
  organization: AdminOrganization | undefined;
};

const makeOrganizationForm = ({
  baseUrl,
  organization,
}: OrganizationFormResource) =>
  FormReact.make(organizationFormBuilder, {
    fields: {
      name: TextField,
      slug: TextField,
      logo: ImageField,
      parentId: SingleSearchableSelectField,
    },
    mode: { validation: "onSubmit" },
    onSubmit: (_, { decoded }) =>
      Effect.gen(function* () {
        const http = yield* authHttpClient(baseUrl);
        const logoValue = decoded.logo;
        let logo = assetPath(logoValue instanceof File ? null : logoValue);
        if (logoValue instanceof File) {
          const payload = new FormData();
          payload.append("file", logoValue);
          const uploaded = yield* http.authExtra.uploadUserImage({ payload });
          logo = assetPath(uploaded.url);
        }

        const input = {
          name: decoded.name.trim(),
          slug: slugify(decoded.slug || decoded.name),
          logo: logo ?? undefined,
        };
        const payload = Schema.decodeUnknownSync(
          AdminCreateOrganizationPayload,
        )(
          decoded.parentId === noParentOrganization
            ? input
            : { ...input, parentId: decoded.parentId },
        );
        const saved = organization
          ? yield* http.admin.updateOrganization({
              params: { id: organization.id },
              payload: {
                ...payload,
                parentId:
                  decoded.parentId === noParentOrganization
                    ? null
                    : decoded.parentId,
              },
            })
          : yield* http.admin.createOrganization({ payload });

        return saved;
      }),
  });

export function AdminOrganizationForm({
  organization,
  onClose,
  onSaved,
}: {
  organization?: AdminOrganization;
  onClose: () => void;
  onSaved: (organization: AdminOrganization) => void;
}) {
  const auth = useKrakstackAuth();
  const m = labels(auth?.locale ?? "en");
  const baseUrl = auth?.baseUrl;
  const organizationsResult = useAtomValue(organizationOptionsAtom(baseUrl));
  const organizations = AsyncResult.match(organizationsResult, {
    onInitial: () => [],
    onFailure: () => [],
    onSuccess: ({ value }) => Array.from(value.data),
  });
  const [form] = useState(() =>
    makeOrganizationForm({ baseUrl, organization }),
  );
  const submitResult = useAtomValue(form.submit);
  useAtomSubscribe(form.submit, (result) => {
    if (!AsyncResult.isSuccess(result)) return;
    toast.success(
      organization
        ? m.organization_updated_toast
        : m.organization_created_toast,
    );
    onSaved(result.value);
    onClose();
  });
  const parentOptions = [
    { label: m.organization_parent_none, value: noParentOrganization },
    ...organizations
      .filter(
        (candidate) =>
          candidate.id !== organization?.id &&
          !candidate.userId &&
          !candidate.parentId,
      )
      .map((candidate) => ({
        label: candidate.name,
        value: candidate.id,
        data: candidate,
      })),
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {organization
              ? m.organization_edit_title
              : m.organization_create_title}
          </DialogTitle>
          <DialogDescription>
            {organization
              ? text(m.admin_organization_edit_description, {
                  name: organization.name,
                })
              : m.organization_create_description}
          </DialogDescription>
        </DialogHeader>
        <form.Initialize
          defaultValues={{
            name: organization?.name ?? "",
            slug: organization?.slug ?? "",
            logo: assetUrl(organization?.logo, baseUrl),
            parentId: organization?.parentId ?? noParentOrganization,
          }}
        >
          <div className="flex flex-col gap-4">
            <form.name autoFocus label={m.field_name} />
            <form.slug
              description={m.organization_slug_description}
              label={m.organization_slug}
            />
            <form.logo
              label={m.organization_field_logo_url}
              size={{
                width: 96,
                height: 96,
                suggestedWidth: 512,
                suggestedHeight: 512,
              }}
            />
            <form.parentId
              description={m.organization_parent_description}
              emptyLabel={m.organization_parent_empty}
              items={parentOptions}
              label={m.organization_parent}
              messages={{ search: m.organization_parent_search }}
              placeholder={m.organization_parent_none}
            />
            <SubmitError result={submitResult} />
            <SubmitButton form={form}>{m.form_submit}</SubmitButton>
          </div>
        </form.Initialize>
      </DialogContent>
    </Dialog>
  );
}
