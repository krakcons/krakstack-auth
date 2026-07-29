import type { ApiKey } from "@better-auth/api-key/client";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { Effect, Schema } from "effect";
import { useState } from "react";

import {
  CheckboxField,
  SubmitButton,
  SubmitError,
  TextAreaField,
  TextField,
} from "@/components/ui/effect-form";

import type { AuthUiClient } from "./auth-client";
import { parseApiKeyReferrers } from "./api-key";
import { apiKeyReferrers, withApiKeyReferrers } from "./api-key-referrers";

type ApiKeySummary = Omit<ApiKey, "key">;

const editApiKeyFormBuilder = FormBuilder.empty
  .addField("name", Schema.NonEmptyString)
  .addField("enabled", Schema.Boolean)
  .addField("referrers", Schema.String);

export type ApiKeyEditMessages = {
  enabled: string;
  name: string;
  referrers: string;
  referrersDescription: string;
  referrersError: string;
  referrersPlaceholder: string;
  updateError: string;
};

export const ApiKeyEditForm = ({
  authClient,
  configId,
  keyData,
  messages,
  onSaved,
}: {
  authClient: AuthUiClient;
  configId: "organization" | "user";
  keyData: ApiKeySummary;
  messages: ApiKeyEditMessages;
  onSaved: () => void;
}) => {
  const [form] = useState(() =>
    FormReact.make(editApiKeyFormBuilder, {
      fields: {
        name: TextField,
        enabled: CheckboxField,
        referrers: TextAreaField,
      },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded }) =>
        Effect.tryPromise({
          try: async () => {
            const referrers = parseApiKeyReferrers(
              decoded.referrers,
              messages.referrersError,
            );
            const result = await authClient.apiKey.update({
              configId,
              keyId: keyData.id,
              name: decoded.name.trim(),
              enabled: decoded.enabled,
              metadata: withApiKeyReferrers(keyData.metadata, referrers),
            });
            if (result.error) {
              throw new Error(result.error.message ?? messages.updateError);
            }

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
          <SubmitError result={submitResult} />
          <SubmitButton form={form} />
        </form>
      </form.Initialize>
    </section>
  );
};
