import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom, Reactivity } from "effect/reactivity";
import { Effect, Schema } from "effect";
import { useState } from "react";
import { CopyButton } from "@krak-stack/registry/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/ui/field";
import { AdminApiClient } from "@/lib/admin-api-client";
import { m } from "@/paraglide/messages";
import { ConfigureProjectWebhook } from "@/services/webhooks/schema";

const endpoints = Atom.family((projectId: string) =>
  Atom.optimistic(
    AdminApiClient.query("projectWebhooks", "getProjectWebhook", {
      params: { projectId },
      reactivityKeys: [`project-webhook:${projectId}`],
    }),
  ),
);
const saves = Atom.family((projectId: string) =>
  AdminApiClient.runtime.fn((url: string) =>
    Effect.gen(function* () {
      const client = yield* AdminApiClient;
      const saved = yield* client.projectWebhooks.configureProjectWebhook({
        params: { projectId },
        payload: { url },
      });
      yield* Reactivity.invalidate([
        "project-webhooks",
        `project-webhook:${projectId}`,
      ]);
      return saved;
    }),
  ),
);

export const ProjectWebhook = ({ projectId }: { projectId: string }) => {
  const current = useAtomValue(endpoints(projectId));
  const result = useAtomValue(saves(projectId));
  const save = useAtomSet(saves(projectId));
  const [url, setUrl] = useState<string | undefined>();
  const endpoint = AsyncResult.match(current, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  });
  const value = url ?? endpoint?.url ?? "";
  const valid = Schema.is(ConfigureProjectWebhook)({ url: value });
  const invalid = value.length > 0 && !valid;
  return (
    <section className="mt-6 flex flex-col gap-3 border-t pt-4">
      <h3 className="font-medium">{m.project_webhook_title()}</h3>
      <p className="text-muted-foreground text-sm">
        {m.project_webhook_description()}
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) save(value);
        }}
      >
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor={`webhook-url-${projectId}`}>
            {m.project_webhook_url()}
          </FieldLabel>
          <Input
            id={`webhook-url-${projectId}`}
            type="url"
            aria-invalid={invalid}
            aria-describedby={
              invalid ? `webhook-url-error-${projectId}` : undefined
            }
            value={value}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://app.example.com/api/webhooks/auth"
          />
          {invalid ? (
            <p
              id={`webhook-url-error-${projectId}`}
              role="alert"
              className="text-destructive text-sm"
            >
              {m.project_webhook_url_invalid()}
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={result.waiting || !valid}>
          {m.form_submit()}
        </Button>
        {AsyncResult.isFailure(result) || AsyncResult.isFailure(current) ? (
          <p role="alert">{m.project_webhook_error()}</p>
        ) : null}
      </form>
      {endpoint ? (
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor={`webhook-secret-${projectId}`}>
            {m.project_webhook_secret()}
          </FieldLabel>
          <div className="flex gap-2">
            <Input
              id={`webhook-secret-${projectId}`}
              type="password"
              readOnly
              value={endpoint.secret}
            />
            <CopyButton
              value={endpoint.secret}
              valueDescription={m.project_webhook_secret()}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            {m.project_webhook_secret_help()}
          </p>
        </div>
      ) : null}
    </section>
  );
};
