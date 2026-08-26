import { useAtomSet, useAtomSuspense } from "@effect/atom-react";
import { Effect, Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { Check, Loader2, Mail, ShieldAlert } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@krak-stack/registry/copy-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { authSessionAtom, notifyAuthChange } from "./auth-atoms.js";
import { authClientApi, authHttpClient } from "./auth-client-api.js";
import { type KrakstackAuthLocale, useKrakstackAuth } from "./auth-provider.js";
import { AuthForbidden } from "../auth/schema.js";
import type { OrganizationEmail } from "../schema.js";
import {
  isInvitationExpired,
  useInvitationExpirationClock,
} from "./invitation-expiration.js";

const defaultMessages = {
  en: {
    member_required_title: "Organization access required",
    member_required_description: "You need organization access to continue.",
    member_required_org_description:
      "You need access to {organization} before opening the admin area.",
    member_required_no_permission:
      "Your account is signed in, but it does not have access to this organization.",
    member_required_invite_found:
      "You have a pending invitation to {organization}. Accept it to continue.",
    member_required_invite_expired:
      "Your invitation to {organization} has expired. Contact the organization administrator for a new invitation.",
    member_required_accept_invite: "Accept invitation",
    member_required_accepting_invite: "Accepting...",
    member_required_accept_error: "Could not accept the invitation.",
    member_required_contact: "Contact organization",
    member_required_contact_description:
      "If you expected access, contact the organization administrator.",
    member_required_copy_email: "Copy email",
    member_required_copied_email: "Copied email",
  },
  fr: {
    member_required_title: "Accès à l'organisation requis",
    member_required_description:
      "Vous devez disposer d'un accès à l'organisation pour continuer.",
    member_required_org_description:
      "Vous devez avoir accès à {organization} avant d'ouvrir l'administration.",
    member_required_no_permission:
      "Votre compte est connecté, mais il ne dispose pas d'un accès à cette organisation.",
    member_required_invite_found:
      "Vous avez une invitation en attente pour {organization}. Acceptez-la pour continuer.",
    member_required_invite_expired:
      "Votre invitation pour {organization} a expiré. Contactez l'administrateur de l'organisation pour obtenir une nouvelle invitation.",
    member_required_accept_invite: "Accepter l'invitation",
    member_required_accepting_invite: "Acceptation...",
    member_required_accept_error: "Impossible d'accepter l'invitation.",
    member_required_contact: "Contacter l'organisation",
    member_required_contact_description:
      "Si vous pensiez avoir accès, contactez l'administrateur de l'organisation.",
    member_required_copy_email: "Copier l'e-mail",
    member_required_copied_email: "E-mail copié",
  },
} as const;

type MemberRequiredLabels = (typeof defaultMessages)["en"];

export type MemberRequiredMessages = Partial<MemberRequiredLabels>;

export type MemberRequiredProps = {
  organizationId: string;
  contactEmail?: string | undefined;
  children?: ReactNode;
  messages?: MemberRequiredMessages | undefined;
};

type Invitation = {
  id: string;
  status: string;
  expiresAt: Date | string;
  organizationId: string;
  organization?: { name?: string | null } | null;
  organizationName?: string | null | undefined;
};
type FullOrganization = {
  id: string;
  name: string;
  slug: string;
  displayName: string;
  contactEmail?: string | null;
  emails?: ReadonlyArray<OrganizationEmail> | undefined;
  logo: string | null;
  icon: string | null;
};

const interpolate = (value: string, params?: Record<string, string>) =>
  Object.entries(params ?? {}).reduce(
    (current, [key, replacement]) => current.replace(`{${key}}`, replacement),
    value,
  );

const labels = (
  locale: KrakstackAuthLocale | undefined,
  overrides: MemberRequiredMessages | undefined,
) => ({
  ...(locale === "fr" ? defaultMessages.fr : defaultMessages.en),
  ...overrides,
});

const invitationMatches = (invitation: Invitation, organizationId: string) =>
  invitation.status === "pending" &&
  invitation.organizationId === organizationId;

const organizationContactEmail = (
  organization: FullOrganization | null,
  fallback: string | undefined,
) =>
  organization?.contactEmail ??
  organization?.emails?.[0]?.email ??
  fallback ??
  null;

const organizationDisplayName = (
  invitation: Invitation | null,
  organization: FullOrganization | null,
  fallback: string,
) =>
  organization?.displayName ??
  organization?.name ??
  invitation?.organization?.name ??
  invitation?.organizationName ??
  fallback;

type AccessResult =
  | { allowed: true }
  | {
      allowed: false;
      invitation: Invitation | null;
      organization: FullOrganization | null;
    };

const acceptInvitationAtom = Atom.family((baseUrl?: string | undefined) =>
  Atom.fn(
    (
      {
        invitationId,
        organizationId,
        onFailure,
        onSuccess,
      }: {
        invitationId: string;
        organizationId: string;
        onFailure: (cause: unknown) => void;
        onSuccess: () => void;
      },
      get,
    ) =>
      Effect.gen(function* () {
        const client = yield* authHttpClient(baseUrl);
        yield* client.auth.organizationAcceptInvitation({
          payload: { invitationId },
        });
        yield* client.auth
          .organizationSetActive({ payload: { organizationId } })
          .pipe(Effect.catchCause(() => Effect.void));
        get.refresh(authSessionAtom(baseUrl));
        yield* get.result(authSessionAtom(baseUrl), {
          suspendOnWaiting: true,
        });
        yield* Effect.sync(notifyAuthChange);
      }).pipe(
        Effect.match({
          onFailure,
          onSuccess,
        }),
      ),
  ),
);

const organizationProfileAtom = Atom.family((baseUrl?: string | undefined) =>
  Atom.family((key: string) => {
    const ProfileKey = Schema.fromJsonString(
      Schema.Struct({
        locale: Schema.optional(Schema.Literals(["en", "fr"])),
        organizationId: Schema.String,
      }),
    );
    const { locale, organizationId } =
      Schema.decodeUnknownSync(ProfileKey)(key);
    const query = locale ? { organizationId, locale } : { organizationId };

    return authClientApi(baseUrl).query(
      "authExtra",
      "getOrganizationPublicProfile",
      {
        query,
        timeToLive: "5 minutes",
        serializationKey: `member-organization-profile:${key}`,
      },
    );
  }),
);

const invitationsAtom = Atom.family((baseUrl?: string | undefined) =>
  Atom.family((accessKey: string) =>
    authClientApi(baseUrl).query("auth", "organizationListUserInvitations", {
      query: {},
      serializationKey: `member-invitations:${accessKey}`,
    }),
  ),
);

const accessAtom = Atom.family((baseUrl?: string | undefined) =>
  Atom.family((key: string) => {
    const AccessKey = Schema.fromJsonString(
      Schema.Struct({
        baseUrl: Schema.optional(Schema.String),
        locale: Schema.optional(Schema.Literals(["en", "fr"])),
        organizationId: Schema.String,
        userId: Schema.optional(Schema.String),
      }),
    );
    const { locale, organizationId } = Schema.decodeUnknownSync(AccessKey)(key);

    return Atom.keepAlive(
      Atom.make((get) =>
        Effect.gen(function* () {
          const client = yield* authHttpClient(baseUrl);
          const allowed = yield* client.auth
            .organizationSetActive({ payload: { organizationId } })
            .pipe(
              Effect.as(true),
              Effect.catch((error) =>
                error instanceof AuthForbidden
                  ? Effect.succeed(false)
                  : Effect.fail(error),
              ),
            );

          if (allowed) {
            get.refresh(authSessionAtom(baseUrl));
            yield* get.result(authSessionAtom(baseUrl), {
              suspendOnWaiting: true,
            });
            return { allowed: true } satisfies AccessResult;
          }

          const profileKey = JSON.stringify({ locale, organizationId });
          const { organization, invitations } = yield* Effect.all(
            {
              organization: get
                .result(organizationProfileAtom(baseUrl)(profileKey), {
                  suspendOnWaiting: true,
                })
                .pipe(
                  Effect.matchCause({
                    onFailure: () => null,
                    onSuccess: (value) => value,
                  }),
                ),
              invitations: get.result(invitationsAtom(baseUrl)(key), {
                suspendOnWaiting: true,
              }),
            },
            { concurrency: "unbounded" },
          );

          return {
            allowed: false,
            organization,
            invitation:
              invitations.find((item) =>
                invitationMatches(item, organizationId),
              ) ?? null,
          } satisfies AccessResult;
        }),
      ),
    );
  }),
);

const accessAtomKey = ({
  authRefreshVersion,
  baseUrl,
  locale,
  organizationId,
  userId,
}: {
  authRefreshVersion: number;
  baseUrl?: string | undefined;
  locale?: KrakstackAuthLocale | undefined;
  organizationId: string;
  userId?: string | undefined;
}) =>
  JSON.stringify({
    authRefreshVersion,
    baseUrl,
    locale,
    organizationId,
    userId,
  });

export function MemberRequired({
  organizationId,
  contactEmail,
  children,
  messages,
}: MemberRequiredProps) {
  const auth = useKrakstackAuth();
  const baseUrl = auth?.baseUrl;
  const authRefreshVersion = auth?.authRefreshVersion ?? 0;
  const locale = auth?.locale;
  const refreshAuth = auth?.refreshAuth;
  const session = useAtomSuspense(authSessionAtom(baseUrl), {
    suspendOnWaiting: true,
  }).value;
  const userId = session?.user.id;
  const currentAccessKey = accessAtomKey({
    authRefreshVersion,
    baseUrl,
    locale,
    organizationId,
    userId,
  });
  const [allowedAccessKey, setAllowedAccessKey] = useState<string | null>(null);

  if (allowedAccessKey === currentAccessKey) return <>{children}</>;

  return (
    <MemberRequiredGate
      accessKey={currentAccessKey}
      baseUrl={baseUrl}
      contactEmail={contactEmail}
      locale={locale}
      messages={messages}
      onAccessAllowed={() => setAllowedAccessKey(currentAccessKey)}
      organizationId={organizationId}
      refreshAuth={refreshAuth}
    >
      {children}
    </MemberRequiredGate>
  );
}

function MemberRequiredGate({
  accessKey,
  baseUrl,
  contactEmail,
  children,
  locale,
  messages,
  onAccessAllowed,
  organizationId,
  refreshAuth,
}: {
  accessKey: string;
  baseUrl?: string | undefined;
  contactEmail?: string | undefined;
  children?: ReactNode;
  locale?: KrakstackAuthLocale | undefined;
  messages?: MemberRequiredMessages | undefined;
  onAccessAllowed: () => void;
  organizationId: string;
  refreshAuth?: (() => void) | undefined;
}) {
  const m = labels(locale, messages);
  const accessResult = useAtomSuspense(accessAtom(baseUrl)(accessKey), {
    suspendOnWaiting: true,
  });
  const acceptInvitationMutation = useAtomSet(acceptInvitationAtom(baseUrl));
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const access = accessResult.value;
  const invitationNow = useInvitationExpirationClock(
    access.allowed || !access.invitation ? [] : [access.invitation],
  );

  useEffect(() => {
    if (!access.allowed) return;

    onAccessAllowed();
  }, [access.allowed, onAccessAllowed]);

  if (access.allowed) return <>{children}</>;

  const { invitation, organization } = access;
  const invitationExpired = invitation
    ? isInvitationExpired(invitation, invitationNow)
    : false;

  const displayName = organizationDisplayName(
    invitation,
    organization,
    organizationId,
  );
  const resolvedContactEmail = organizationContactEmail(
    organization,
    contactEmail,
  );

  const acceptInvitation = () => {
    if (!invitation || isInvitationExpired(invitation)) return;
    setAccepting(true);
    setError(null);

    acceptInvitationMutation({
      invitationId: invitation.id,
      organizationId: invitation.organizationId,
      onFailure: (cause) => {
        setAccepting(false);
        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : m.member_required_accept_error,
        );
      },
      onSuccess: () => {
        refreshAuth?.();
        onAccessAllowed();
        setAccepting(false);
      },
    });
  };

  return (
    <main className="relative grid min-h-screen place-items-center px-6 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="bg-destructive/10 text-destructive mb-2 flex size-10 items-center justify-center rounded-md">
            <ShieldAlert />
          </div>
          <CardTitle>{m.member_required_title}</CardTitle>
          <CardDescription>
            {interpolate(m.member_required_org_description, {
              organization: displayName,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {invitation ? (
            <p className="text-muted-foreground text-sm">
              {interpolate(
                invitationExpired
                  ? m.member_required_invite_expired
                  : m.member_required_invite_found,
                { organization: displayName },
              )}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              {m.member_required_contact_description}
            </p>
          )}
          {resolvedContactEmail ? (
            <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <Mail className="text-muted-foreground size-4 shrink-0" />
                <span className="truncate">{resolvedContactEmail}</span>
              </span>
              <CopyButton
                value={resolvedContactEmail}
                valueDescription={resolvedContactEmail}
                variant="ghost"
                className="shrink-0"
                messages={{
                  copy: m.member_required_copy_email,
                  copied: m.member_required_copied_email,
                }}
              />
            </div>
          ) : null}
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {invitation && !invitationExpired ? (
            <Button onClick={acceptInvitation} disabled={accepting}>
              {accepting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {accepting
                ? m.member_required_accepting_invite
                : m.member_required_accept_invite}
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </main>
  );
}
