import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { m } from "@/paraglide/messages";
import { authClient } from "@/services/auth/client";
import { useAppForm } from "@/components/ui/form";
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
  validateSearch: (search: Record<string, unknown>) => ({
    clientId:
      typeof search.client_id === "string"
        ? search.client_id
        : m.consent_connected_application(),
    scope:
      typeof search.scope === "string" ? search.scope : "openid profile email",
  }),
  component: Consent,
});

function Consent() {
  const navigate = useNavigate();
  const { clientId, scope } = Route.useSearch();
  const scopes = scope.split(" ").filter(Boolean);
  const projectConfig = useAuthBrandingConfig();
  const fallbackClientName = useOAuthClientName(clientId);
  const clientName = projectConfig?.name ?? fallbackClientName;
  const form = useAppForm({
    defaultValues: {},
    onSubmitMeta: { accept: true },
    onSubmit: async ({ meta, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });

      const result = await authClient.oauth2.consent({
        accept: meta.accept,
        scope,
      });

      if (result.error) {
        formApi.setErrorMap({
          onSubmit: {
            form: result.error.message ?? m.consent_error(),
            fields: {},
          },
        });
        return;
      }

      navigate({ href: result.data?.url ?? "/" });
    },
  });

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-3xl">{m.consent_title()}</CardTitle>
        <CardDescription>
          {m.consent_description({ clientName })}
        </CardDescription>
      </CardHeader>
      <form.AppForm>
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
          <form.FormError />
        </CardContent>
        <CardFooter className="gap-3">
          <form.Subscribe selector={(formState) => formState.isSubmitting}>
            {(isSubmitting) => (
              <>
                <Button
                  disabled={isSubmitting}
                  onClick={() => form.handleSubmit({ accept: true })}
                  type="button"
                >
                  {m.consent_authorize()}
                </Button>
                <Button
                  disabled={isSubmitting}
                  onClick={() => form.handleSubmit({ accept: false })}
                  type="button"
                  variant="outline"
                >
                  {m.consent_deny()}
                </Button>
              </>
            )}
          </form.Subscribe>
        </CardFooter>
      </form.AppForm>
    </Card>
  );
}

const useOAuthClientName = (clientId: string) => {
  const { data } = useQuery({
    queryKey: ["oauth", "public-client", clientId],
    queryFn: async () => {
      const result = await authClient.$fetch("/oauth2/public-client", {
        method: "GET",
        query: { client_id: clientId },
      });

      if (result.error) return clientId;

      return getOAuthClientDisplayName(result.data, clientId);
    },
  });

  return data ?? clientId;
};

const getOAuthClientDisplayName = (data: unknown, fallback: string) => {
  if (typeof data !== "object" || data === null) return fallback;

  const clientName = "client_name" in data ? data.client_name : undefined;
  if (typeof clientName === "string" && clientName) return clientName;

  const clientId = "client_id" in data ? data.client_id : undefined;
  if (typeof clientId === "string" && clientId) return clientId;

  return fallback;
};
