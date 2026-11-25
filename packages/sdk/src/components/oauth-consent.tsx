import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { useRouterState } from "@tanstack/react-router";
import { Effect, Option, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";
import { useId, useMemo, useState } from "react";
import {
  Bot,
  BookOpen,
  Building2,
  CircleAlert,
  KeyRound,
  Mail,
  Pencil,
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AppBrand } from "./appearance.js";
import { authClientApi, authHttpClient } from "./auth-client-api.js";
import { authOrganizationsAtom, authSessionAtom } from "./auth-atoms.js";
import { useKrakstackAuth, type KrakstackAuthLocale } from "./auth-provider.js";
import { assetUrl, cn, organizationBranding } from "./utils.js";
import { getOAuthAuthorizationQuery } from "../oauth/authorization.js";

const ConsentSearch = Schema.Struct({
  client_id: Schema.NonEmptyString,
  sig: Schema.NonEmptyString,
  scope: Schema.optional(Schema.String),
}).annotate({ identifier: "OAuthConsentSearch" });

export type OAuthConsentMessages = {
  readonly title: string;
  readonly description: (input: { clientName: string; email?: string }) => string;
  readonly requestedScopes: string;
  readonly allow: string;
  readonly deny: string;
  readonly error: string;
  readonly invalidRequest: string;
  readonly organizationLabel: string;
  readonly organizationPlaceholder: string;
  readonly organizationUnavailable: string;
  readonly organizationNotice: string;
  readonly notice?: string;
  readonly permissions?: Readonly<
    Record<string, { readonly title: string; readonly description?: string }>
  >;
};

const defaultMessages = {
  en: {
    title: "Authorize application",
    description: ({ clientName, email }) =>
      `${clientName} is requesting access to ${email || "your account"}.`,
    requestedScopes: "What this app can do",
    allow: "Authorize",
    deny: "Deny",
    error:
      "We couldn’t complete your request. Try again, or reconnect from the app if the problem persists.",
    invalidRequest:
      "This authorization request is invalid or incomplete. Start again from your application.",
    organizationLabel: "Organization",
    organizationPlaceholder: "Choose an organization",
    organizationUnavailable: "No organizations are available for this connection.",
    organizationNotice: "Access is limited to this organization.",
    notice: "Only connect applications you trust. You can revoke access later.",
    permissions: {
      "mcp:read": {
        title: "Read data you can access",
      },
      "mcp:write": {
        title: "Edit data you can change",
      },
      offline_access: {
        title: "Background access",
        description: "This app can stay connected even after you sign out.",
      },
      openid: { title: "Verify your identity" },
      profile: { title: "View your name and profile picture" },
      email: { title: "View your email address" },
    },
  },
  fr: {
    title: "Autoriser l'application",
    description: ({ clientName, email }) =>
      `${clientName} demande l'accès à ${email || "votre compte"}.`,
    requestedScopes: "Ce que cette application peut faire",
    allow: "Autoriser",
    deny: "Refuser",
    error:
      "Impossible de terminer votre demande. Réessayez ou, si le problème persiste, relancez la connexion depuis l’application.",
    invalidRequest:
      "Cette demande d'autorisation est invalide ou incomplète. Recommencez depuis votre application.",
    organizationLabel: "Organisation",
    organizationPlaceholder: "Choisissez une organisation",
    organizationUnavailable: "Aucune organisation n’est disponible pour cette connexion.",
    organizationNotice: "L’accès est limité à cette organisation.",
    notice:
      "Connectez uniquement des applications de confiance. Vous pourrez révoquer l'accès plus tard.",
    permissions: {
      "mcp:read": {
        title: "Lire les données auxquelles vous avez accès",
      },
      "mcp:write": {
        title: "Modifier les données que vous pouvez changer",
      },
      offline_access: {
        title: "Accès en arrière-plan",
        description: "Cette application peut rester connectée même après votre déconnexion.",
      },
      openid: { title: "Vérifier votre identité" },
      profile: { title: "Consulter votre nom et votre photo de profil" },
      email: { title: "Consulter votre adresse courriel" },
    },
  },
} satisfies Record<KrakstackAuthLocale, OAuthConsentMessages>;

const scopeIcon = (scope: string): LucideIcon => {
  switch (scope) {
    case "mcp:read":
      return BookOpen;
    case "mcp:write":
      return Pencil;
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

const noQuery = Atom.make(null);

const OrganizationOption = ({
  label,
  slug,
  image,
}: {
  label: string;
  slug: string;
  image: string;
}) => (
  <AppBrand
    to={null}
    label={label}
    subtitle={slug}
    icon={Building2}
    imageSrc={image}
    classNames={{ visual: "size-7", image: "object-contain" }}
  />
);

const makeConsentAtom = (baseUrl: string | undefined, search: string) => {
  const oauthQuery = getOAuthAuthorizationQuery(search) ?? "";
  const scope = new URLSearchParams(oauthQuery).get("scope") ?? "";
  return Atom.fn(({ accept, organizationId }: { accept: boolean; organizationId?: string }) =>
    authHttpClient(baseUrl).pipe(
      Effect.flatMap((api) =>
        api.auth.oauthConsent({
          headers: organizationId ? { "x-oauth-consent-organization": organizationId } : {},
          payload: { accept, scope, oauth_query: oauthQuery },
        }),
      ),
    ),
  );
};

/** Shared login-provider-aware consent. The signed OAuth query is sent intact;
 * the provider, not the component, validates scopes, grants and callbacks. */
export const OAuthConsent = ({
  messages: overrides,
  baseUrl: providedBaseUrl,
}: {
  readonly messages?: Partial<OAuthConsentMessages>;
  readonly baseUrl?: string;
}) => {
  const auth = useKrakstackAuth();
  const locale = auth?.locale ?? "en";
  const defaults = defaultMessages[locale];
  const messages: OAuthConsentMessages = {
    ...defaults,
    ...overrides,
    permissions: { ...defaults.permissions, ...overrides?.permissions },
  };
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
  const requestedScopes = [...new Set(scope.split(/\s+/).filter(Boolean))];
  const permissions = requestedScopes.filter((scope) => scope !== "offline_access");
  const backgroundAccess = requestedScopes.includes("offline_access")
    ? (messages.permissions?.offline_access?.description ??
      defaults.permissions.offline_access.description)
    : null;
  const client = useAtomValue(clientAtom(baseUrl)(clientId));
  const clientName = AsyncResult.isSuccess(client)
    ? client.value.client_name || client.value.client_id
    : clientId;
  // A fresh atom per signed request prevents decisions/results leaking between
  // successive consent screens for different agents or grants.
  const submitAtom = useMemo(() => makeConsentAtom(baseUrl, search), [baseUrl, search]);
  const submit = useAtomSet(submitAtom);
  const result = useAtomValue(submitAtom);
  useAtomSubscribe(submitAtom, (result) => {
    if (AsyncResult.isSuccess(result)) window.location.assign(result.value.url);
  });
  const invalid = Option.isNone(decoded) || oauthQuery === null;
  const isMcp =
    !invalid && requestedScopes.some((value) => value === "mcp:read" || value === "mcp:write");
  const session = useAtomValue(invalid ? noQuery : authSessionAtom(baseUrl));
  const currentSession = session && AsyncResult.isSuccess(session) ? session.value : null;
  const email = currentSession?.user.email;
  const sessionLoading = session !== null && AsyncResult.isInitial(session);
  const descriptionLoading = AsyncResult.isInitial(client) || sessionLoading;
  const clientDescription = messages.description(email ? { clientName, email } : { clientName });
  const emailStart = email ? clientDescription.lastIndexOf(email) : -1;
  const organizations = useAtomValue(isMcp ? authOrganizationsAtom(baseUrl) : noQuery);
  const organizationLoading =
    sessionLoading || (organizations !== null && AsyncResult.isInitial(organizations));
  const organizationFieldId = useId();
  const [selection, setSelection] = useState<{
    request: string | null;
    baseUrl: string | undefined;
    id: string;
  }>();
  const activeId = currentSession?.session.activeOrganizationId;
  const items =
    organizations && AsyncResult.isSuccess(organizations)
      ? organizations.value.map((organization) => {
          const branding = organizationBranding(organization, locale);
          return {
            value: organization.id,
            label: branding?.name ?? organization.name,
            slug: organization.slug,
            image: assetUrl(branding?.logo, baseUrl),
          };
        })
      : [];
  const selectedId =
    selection && selection.request === oauthQuery && selection.baseUrl === baseUrl
      ? selection.id
      : activeId;
  const selectedOrganization = items.find(({ value }) => value === selectedId);
  const organizationId = selectedOrganization?.value;

  return (
    <Card className="w-full max-w-md rounded-2xl shadow-sm">
      <CardHeader className="items-center gap-3 text-center">
        <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-2xl">
          <Bot className="size-6" aria-hidden="true" />
        </div>
        <CardTitle className="text-xl">{messages.title}</CardTitle>
        {invalid ? (
          <CardDescription className="text-pretty">{messages.invalidRequest}</CardDescription>
        ) : (
          <CardDescription aria-busy={descriptionLoading} className="min-h-10 min-w-0">
            {descriptionLoading ? (
              <div
                className="flex h-10 flex-col items-center justify-center gap-2"
                aria-hidden="true"
              >
                <Skeleton className="h-3 w-3/4 motion-reduce:animate-none" />
                <Skeleton className="h-3 w-1/2 motion-reduce:animate-none" />
              </div>
            ) : (
              <p className="wrap-anywhere text-pretty">
                {email && emailStart >= 0 ? (
                  <>
                    {clientDescription.slice(0, emailStart)}
                    <strong className="font-medium">{email}</strong>
                    {clientDescription.slice(emailStart + email.length)}
                  </>
                ) : (
                  clientDescription
                )}
              </p>
            )}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isMcp && (
          <Field aria-busy={organizationLoading}>
            <FieldLabel htmlFor={organizationFieldId}>{messages.organizationLabel}</FieldLabel>
            <Select
              items={items}
              value={organizationId ?? null}
              disabled={organizationLoading || !items.length || result.waiting}
              onValueChange={(id) => {
                if (id) setSelection({ request: oauthQuery, baseUrl, id });
              }}
            >
              <SelectTrigger
                id={organizationFieldId}
                aria-describedby={`${organizationFieldId}-notice`}
                className="min-h-12 w-full"
              >
                <SelectValue
                  render={<div />}
                  className="min-w-0"
                  placeholder={messages.organizationPlaceholder}
                >
                  {organizationLoading ? (
                    <div className="flex w-full items-center gap-2" aria-hidden="true">
                      <Skeleton className="size-7 shrink-0 motion-reduce:animate-none" />
                      <Skeleton className="h-3 w-1/2 motion-reduce:animate-none" />
                    </div>
                  ) : selectedOrganization ? (
                    <OrganizationOption {...selectedOrganization} />
                  ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value} label={item.label}>
                      <OrganizationOption {...item} />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription id={`${organizationFieldId}-notice`} className="grid">
              <span className="col-start-1 row-start-1">
                {organizationLoading || items.length > 0
                  ? messages.organizationNotice
                  : messages.organizationUnavailable}
              </span>
              <span aria-hidden="true" className="invisible col-start-1 row-start-1">
                {organizationLoading || items.length > 0
                  ? messages.organizationUnavailable
                  : messages.organizationNotice}
              </span>
            </FieldDescription>
          </Field>
        )}
        {isMcp && permissions.length > 0 && <Separator className="my-1" />}
        {permissions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{messages.requestedScopes}</p>
            <ul className="flex flex-col gap-2">
              {permissions.map((scope) => {
                const permission = messages.permissions?.[scope];
                const title = permission?.title ?? scope;
                const verbEnd =
                  scope === "mcp:read" || scope === "mcp:write" ? title.search(/\s/) : -1;
                const Icon = scopeIcon(scope);
                return (
                  <li key={scope} className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
                    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm">
                        {verbEnd > 0 ? (
                          <>
                            <strong className="font-semibold">{title.slice(0, verbEnd)}</strong>
                            {title.slice(verbEnd)}
                          </>
                        ) : (
                          title
                        )}
                      </p>
                      {permission?.description && (
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {permission.description}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2">
        {(backgroundAccess || messages.notice) && (
          <p className="text-muted-foreground mb-2 text-center text-xs">
            {[backgroundAccess, messages.notice].filter(Boolean).join(" ")}
          </p>
        )}
        {AsyncResult.isFailure(result) && (
          <p
            role="alert"
            className={cn(
              "text-destructive mb-1 flex w-full items-start gap-2 text-sm",
              result.waiting && "invisible",
            )}
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{messages.error}</span>
          </p>
        )}
        <Button
          disabled={
            invalid || result.waiting || (isMcp && (organizationLoading || !organizationId))
          }
          onClick={() => submit({ accept: true, organizationId })}
          className="w-full"
        >
          {messages.allow}
        </Button>
        <Button
          disabled={invalid || result.waiting}
          variant="ghost"
          onClick={() => submit({ accept: false })}
          className="w-full"
        >
          {messages.deny}
        </Button>
      </CardFooter>
    </Card>
  );
};
