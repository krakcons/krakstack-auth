import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useMemo } from "react";

import { m } from "@/paraglide/messages";
import { AuthApiClient } from "@/services/auth/client";
import { SubmitError } from "@krak-stack/registry/effect-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthBrandingConfig } from "@/services/auth/client/branding";

export const Route = createFileRoute("/_auth/consent")({
  validateSearch: (search) => ({
    clientId: Option.getOrElse(
      Schema.decodeUnknownOption(Schema.String)(search.client_id),
      () => m.consent_connected_application(),
    ),
    scope: Option.getOrElse(
      Schema.decodeUnknownOption(Schema.String)(search.scope),
      () => "openid profile email",
    ),
  }),
  component: Consent,
});

const consentFormBuilder = FormBuilder.empty;
const consentMutation = AuthApiClient.mutation("auth", "oauthConsent");
const oauthClientAtom = Atom.family((clientId: string) =>
  AuthApiClient.query("auth", "oauthPublicClient", {
    query: { client_id: clientId },
    timeToLive: "5 minutes",
  }),
);

const makeConsentForm = (scope: string) =>
  FormReact.make(consentFormBuilder, {
    fields: {},
    onSubmit: (accept: boolean, { get }) =>
      get.setResult(consentMutation, {
        payload: { accept, scope },
      }),
  });

function Consent() {
  const navigate = useNavigate();
  const { clientId, scope } = Route.useSearch();
  const scopes = scope.split(" ").filter(Boolean);
  const projectConfig = useAuthBrandingConfig();
  const fallbackClientName = useOAuthClientName(clientId);
  const clientName = projectConfig?.name ?? fallbackClientName;
  const form = useMemo(() => makeConsentForm(scope), [scope]);
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);
  useAtomSubscribe(form.submit, (result) => {
    if (AsyncResult.isSuccess(result)) navigate({ href: result.value.url });
  });

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-3xl">{m.consent_title()}</CardTitle>
        <CardDescription>
          {m.consent_description({ clientName })}
        </CardDescription>
      </CardHeader>
      <form.Initialize defaultValues={{}}>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">
              {m.consent_requested_scopes()}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scopes.map((item) => (
                <span
                  className="rounded-md border px-3 py-1 text-sm"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <SubmitError result={submitResult} />
        </CardContent>
        <CardFooter className="gap-3">
          <Button
            disabled={submitResult.waiting}
            onClick={() => submit(true)}
            type="button"
          >
            {m.consent_authorize()}
          </Button>
          <Button
            disabled={submitResult.waiting}
            onClick={() => submit(false)}
            type="button"
            variant="outline"
          >
            {m.consent_deny()}
          </Button>
        </CardFooter>
      </form.Initialize>
    </Card>
  );
}

const useOAuthClientName = (clientId: string) => {
  const result = useAtomValue(oauthClientAtom(clientId));

  return AsyncResult.match(result, {
    onInitial: () => clientId,
    onFailure: () => clientId,
    onSuccess: ({ value }) => value.client_name || value.client_id,
  });
};
