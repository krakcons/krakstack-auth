import type { ApiKey } from "@better-auth/api-key/client";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { Effect, Schema } from "effect";
import { useRef, useState } from "react";

import type { ProjectAccessLabelCatalog } from "../access";

import {
  CheckboxField,
  SubmitButton,
  SubmitError,
  TextAreaField,
  TextField,
} from "@/components/ui/effect-form";
import { parseApiKeyReferrers, updateApiKey } from "./api-key";
import { ApiKeyPermissions } from "./api-key-permissions";
import { apiKeyReferrers } from "./api-key-referrers";
import { ExtraApiKeyPermissions } from "../extra/schema";

type ApiKeySummary = Omit<ApiKey, "key">;

const editApiKeyFormBuilder = FormBuilder.empty
  .addField("name", Schema.NonEmptyString)
  .addField("enabled", Schema.Boolean)
  .addField("referrers", Schema.String)
  .addField("permissions", Schema.Record(Schema.String, Schema.Boolean));

type ApiKeyPermissionsFieldOptions = {
  description: string;
  idPrefix: string;
  labels?: ProjectAccessLabelCatalog | undefined;
  permissions: Readonly<Record<string, ReadonlyArray<string>>>;
  title: string;
};

const ApiKeyPermissionsField: FormReact.FieldComponent<
  Readonly<Record<string, boolean>>,
  ApiKeyPermissionsFieldOptions
> = ({ field, props }) => (
  <ApiKeyPermissions
    description={props.description}
    idPrefix={props.idPrefix}
    permissions={props.permissions}
    labels={props.labels}
    selected={field.value}
    title={props.title}
    onChange={(id, checked) =>
      field.onChange({ ...field.value, [id]: checked })
    }
  />
);

export type ApiKeyEditMessages = {
  enabled: string;
  name: string;
  referrers: string;
  referrersDescription: string;
  referrersError: string;
  referrersPlaceholder: string;
  permissions: string;
  permissionsDescription: string;
  updateError: string;
};

export const ApiKeyEditForm = ({
  configId,
  keyData,
  messages,
  permissions,
  permissionLabels,
  onSaved,
}: {
  configId: "organization" | "user";
  keyData: ApiKeySummary;
  messages: ApiKeyEditMessages;
  permissions: Readonly<Record<string, ReadonlyArray<string>>>;
  permissionLabels?: ProjectAccessLabelCatalog | undefined;
  onSaved: () => void;
}) => {
  const permissionOptions = Object.entries(permissions).flatMap(
    ([project, actions]) =>
      actions.map((action) => ({
        id: `${project}:${action}`,
        project,
        action,
      })),
  );
  const currentPermissions = Schema.decodeUnknownOption(ExtraApiKeyPermissions)(
    keyData.permissions ?? {},
  );
  const currentGrant =
    currentPermissions._tag === "Some" ? currentPermissions.value : {};
  const initialSelectedPermissions = Object.fromEntries(
    permissionOptions.map((option) => [
      option.id,
      currentGrant[option.project]?.includes(option.action) ?? false,
    ]),
  );
  const permissionOptionsRef = useRef(permissionOptions);
  const permissionsRef = useRef(permissions);
  permissionOptionsRef.current = permissionOptions;
  permissionsRef.current = permissions;
  const [form] = useState(() =>
    FormReact.make(editApiKeyFormBuilder, {
      fields: {
        name: TextField,
        enabled: CheckboxField,
        referrers: TextAreaField,
        permissions: ApiKeyPermissionsField,
      },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded }) =>
        Effect.tryPromise({
          try: async () => {
            const referrers = parseApiKeyReferrers(
              decoded.referrers,
              messages.referrersError,
            );
            const selectedGrant: Record<string, string[]> = {};
            for (const project of Object.keys(permissionsRef.current)) {
              selectedGrant[project] = [];
            }
            for (const option of permissionOptionsRef.current) {
              if (!decoded.permissions[option.id]) continue;
              selectedGrant[option.project] = [
                ...(selectedGrant[option.project] ?? []),
                option.action,
              ];
            }
            await updateApiKey(
              {
                configId,
                keyId: keyData.id,
                name: decoded.name.trim(),
                enabled: decoded.enabled,
                permissions: selectedGrant,
                referrers,
              },
              messages.updateError,
            );

            onSaved();
          },
          catch: (cause) =>
            cause instanceof Error ? cause : new Error(messages.updateError),
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);

  return (
    <section className="w-full">
      <form.Initialize
        defaultValues={{
          name: keyData.name ?? "",
          enabled: keyData.enabled,
          referrers: apiKeyReferrers(keyData.metadata).join("\n"),
          permissions: initialSelectedPermissions,
        }}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            submit();
          }}
        >
          <form.name label={messages.name} required />
          <form.enabled label={messages.enabled} />
          <form.referrers
            label={messages.referrers}
            description={messages.referrersDescription}
            placeholder={messages.referrersPlaceholder}
            rows={3}
          />
          <form.permissions
            description={messages.permissionsDescription}
            idPrefix="edit"
            permissions={permissions}
            labels={permissionLabels}
            title={messages.permissions}
          />
          <SubmitError result={submitResult} />
          <SubmitButton form={form} />
        </form>
      </form.Initialize>
    </section>
  );
};
