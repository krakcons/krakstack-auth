import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom, Reactivity } from "effect/reactivity";
import { Effect, Schema } from "effect";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { CopyButton } from "@krak-stack/registry/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { AdminApiClient } from "@/lib/admin-api-client";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
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
  const [secretRevealed, setSecretRevealed] = useState(false);
  const endpoint = AsyncResult.match(current, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  });
  const value = url ?? endpoint?.url ?? "";
  const valid = Schema.is(ConfigureProjectWebhook)({ url: value });
  const invalid = value.length > 0 && !valid;
  return (
    <section className="flex flex-col gap-3 pt-4">
      {endpoint ? (
        <section className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <h3 className="font-medium">{m.project_webhook_secret()}</h3>
            <p className="text-muted-foreground text-sm">
              {m.project_webhook_secret_help()}
            </p>
          </div>
          <InputGroup className="w-fit max-w-full">
            <InputGroupInput
              aria-label={m.project_webhook_secret()}
              className="flex-initial font-mono"
              style={{ width: `calc(${endpoint.secret.length}ch + 1.25rem)` }}
              type={secretRevealed ? "text" : "password"}
              autoComplete="off"
              readOnly
              value={endpoint.secret}
              onFocus={(event) => event.currentTarget.select()}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                aria-label={
                  secretRevealed
                    ? m.project_webhook_secret_hide()
                    : m.project_webhook_secret_show()
                }
                aria-pressed={secretRevealed}
                onClick={() => setSecretRevealed((revealed) => !revealed)}
              >
                {secretRevealed ? <EyeOff /> : <Eye />}
              </InputGroupButton>
              <CopyButton
                value={endpoint.secret}
                valueDescription={m.project_webhook_secret()}
                locale={getLocale()}
                variant="ghost"
                copyVariant="large"
              />
            </InputGroupAddon>
          </InputGroup>
        </section>
      ) : null}
      {endpoint ? <Separator className="my-4" /> : null}
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
    </section>
  );
};
