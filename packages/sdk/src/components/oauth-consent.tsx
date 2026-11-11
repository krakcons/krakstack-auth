import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { useRouterState } from "@tanstack/react-router";
import { Effect, Option, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";
import { useMemo } from "react";
import {
  Bot,
  BookOpen,
  KeyRound,
  Mail,
  Pencil,
  RefreshCw,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClientApi, authHttpClient } from "./auth-client-api.js";
import { useKrakstackAuth } from "./auth-provider.js";
import { getOAuthAuthorizationQuery } from "../oauth/authorization.js";

const ConsentSearch = Schema.Struct({
  client_id: Schema.NonEmptyString,
  sig: Schema.NonEmptyString,
  scope: Schema.optional(Schema.String),
}).annotate({ identifier: "OAuthConsentSearch" });

export type OAuthConsentMessages = {
  readonly title: string;
  readonly description: (input: { clientName: string }) => string;
  readonly requestedScopes: string;
  readonly allow: string;
  readonly deny: string;
  readonly error: string;
  readonly invalidRequest: string;
  readonly notice?: string;
  readonly permissions?: Readonly<
    Record<string, { readonly title: string; readonly description?: string }>
  >;
};

const scopeIcon = (scope: string): LucideIcon => {
  switch (scope) {
    case "mcp:read":
      return BookOpen;
    case "mcp:write":
      return Pencil;
    case "offline_access":
      return RefreshCw;
    case "openid":
    case "profile":
      return UserRound;
    case "email":
      return Mail;
    default:
      return KeyRound;
  }
};

const clientAtom = Atom.family((baseUrl: string | undefined) =>
  Atom.family((clientId: string) =>
    authClientApi(baseUrl).query("auth", "oauthPublicClient", {
      query: { client_id: clientId },
      timeToLive: "5 minutes",
    }),
  ),
);

const makeConsentAtom = (baseUrl: string | undefined, search: string) => {
  const oauthQuery = getOAuthAuthorizationQuery(search) ?? "";
  const scope = new URLSearchParams(oauthQuery).get("scope") ?? "";
  return Atom.fn((accept: boolean) =>
    authHttpClient(baseUrl).pipe(
      Effect.flatMap((api) =>
        api.auth.oauthConsent({
          payload: { accept, scope, oauth_query: oauthQuery },
        }),
      ),
    ),
  );
};

/** Shared login-provider-aware consent. The signed OAuth query is sent intact;
 * the provider, not the component, validates scopes, grants and callbacks. */
export const OAuthConsent = ({
  messages,
  baseUrl: providedBaseUrl,
}: {
  readonly messages: OAuthConsentMessages;
  readonly baseUrl?: string;
}) => {
  const auth = useKrakstackAuth();
  const baseUrl = providedBaseUrl ?? auth?.baseUrl;
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const oauthQuery = getOAuthAuthorizationQuery(search);
  const decoded = Schema.decodeUnknownOption(ConsentSearch)(
    Object.fromEntries(new URLSearchParams(oauthQuery ?? "")),
  );
  const clientId = Option.isSome(decoded) ? decoded.value.client_id : "";
  const scope = Option.isSome(decoded) ? (decoded.value.scope ?? "") : "";
  const client = useAtomValue(clientAtom(baseUrl)(clientId));
  const clientName = AsyncResult.isSuccess(client)
    ? client.value.client_name || client.value.client_id
    : clientId;
  // A fresh atom per signed request prevents decisions/results leaking between
  // successive consent screens for different agents or grants.
  const submitAtom = useMemo(
    () => makeConsentAtom(baseUrl, search),
    [baseUrl, search],
  );
  const submit = useAtomSet(submitAtom);
  const result = useAtomValue(submitAtom);
  useAtomSubscribe(submitAtom, (result) => {
    if (AsyncResult.isSuccess(result)) window.location.assign(result.value.url);
  });
  const invalid = Option.isNone(decoded) || oauthQuery === null;

  return (
    <Card className="w-full max-w-md rounded-2xl shadow-sm">
      <CardHeader className="items-center gap-3 text-center">
        <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-2xl">
          <Bot className="size-6" aria-hidden="true" />
        </div>
        <CardTitle className="text-xl">{messages.title}</CardTitle>
        <CardDescription className="text-pretty">
          {invalid
            ? messages.invalidRequest
            : messages.description({ clientName })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {messages.requestedScopes}
        </p>
        <ul className="space-y-2">
          {Array.from(new Set(scope.split(/\s+/).filter(Boolean))).map(
            (scope) => {
              const permission = messages.permissions?.[scope];
              const Icon = scopeIcon(scope);
              return (
                <li
                  key={scope}
                  className="bg-muted/50 flex items-start gap-3 rounded-xl p-3"
                >
                  <Icon
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {permission?.title ?? scope}
                    </p>
                    {permission?.description && (
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {permission.description}
                      </p>
                    )}
                  </div>
                </li>
              );
            },
          )}
        </ul>
        {AsyncResult.isFailure(result) && <p role="alert">{messages.error}</p>}
      </CardContent>
      <CardFooter className="flex-col gap-2">
        {messages.notice && (
          <p className="text-muted-foreground mb-2 text-center text-xs">
            {messages.notice}
          </p>
        )}
        <Button
          disabled={invalid || result.waiting}
          onClick={() => submit(true)}
          className="w-full"
        >
          {messages.allow}
        </Button>
        <Button
          disabled={invalid || result.waiting}
          variant="ghost"
          onClick={() => submit(false)}
          className="w-full"
        >
          {messages.deny}
        </Button>
      </CardFooter>
    </Card>
  );
};
