import { useAtomSuspense } from "@effect/atom-react";
import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { Check, Loader2, Mail, ShieldAlert } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { AuthUiClient } from "./auth-client";
import { type KrakstackAuthLocale, useKrakstackAuth } from "./auth-provider";
import {
  isInvitationExpired,
  useInvitationExpirationClock,
} from "./invitation-expiration";

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
  authClient?: AuthUiClient | undefined;
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
  organizationName?: string | null;
};
type FullOrganization = {
  id: string;
  name: string;
  slug: string;
  displayName: string;
  contactEmail: string | null;
  logo: string | null;
  icon: string | null;
};

const isFullOrganization = (value: unknown): value is FullOrganization => {
  if (typeof value !== "object" || value === null) return false;
  if (!("id" in value) || typeof value.id !== "string") return false;
  if (!("name" in value) || typeof value.name !== "string") return false;
  if (!("slug" in value) || typeof value.slug !== "string") return false;
  if (!("displayName" in value) || typeof value.displayName !== "string") {
    return false;
  }

  return true;
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
) => organization?.contactEmail ?? fallback ?? null;

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

const organizationProfileUrl = (
  baseUrl: string | undefined,
  organizationId: string,
) => {
  const root =
    baseUrl?.trim() ||
    (typeof window === "undefined" ? "" : window.location.origin);
  const url = new URL("/api/auth/organization-profile", root);
  url.searchParams.set("organizationId", organizationId);
  return url;
};

const getOrganizationPublicProfile = async (
  baseUrl: string | undefined,
  organizationId: string,
): Promise<FullOrganization | null> => {
  const response = await fetch(
    organizationProfileUrl(baseUrl, organizationId),
    {
      credentials: "include",
    },
  );

  if (!response.ok) return null;
  const body: unknown = await response.json();
  return isFullOrganization(body) ? body : null;
};

type AccessResult =
  | { allowed: true }
  | {
      allowed: false;
      invitation: Invitation | null;
      organization: FullOrganization | null;
    };

const accessAtom = Atom.family((authClient: AuthUiClient) =>
  Atom.family((key: string) => {
    const { baseUrl, organizationId } = JSON.parse(key) as {
      baseUrl?: string | undefined;
      organizationId: string;
      userId?: string | undefined;
    };

    return Atom.keepAlive(
      Atom.make(
        Effect.tryPromise({
          try: async (): Promise<AccessResult> => {
            const activeResult = await authClient.organization.setActive({
              organizationId,
            });

            if (!activeResult.error) return { allowed: true };

            const [organization, invitationsResult] = await Promise.all([
              getOrganizationPublicProfile(baseUrl, organizationId).catch(
                () => null,
              ),
              authClient.organization.listUserInvitations({}),
            ]);

            return {
              allowed: false,
              organization,
              invitation:
                invitationsResult.data?.find((item) =>
                  invitationMatches(item, organizationId),
                ) ?? null,
            };
          },
          catch: (error) => error,
        }),
      ),
    );
  }),
);

const accessAtomKey = ({
  authRefreshVersion,
  baseUrl,
  organizationId,
  userId,
}: {
  authRefreshVersion: number;
  baseUrl?: string | undefined;
  organizationId: string;
  userId?: string | undefined;
}) => JSON.stringify({ authRefreshVersion, baseUrl, organizationId, userId });

export function MemberRequired({
  authClient: providedAuthClient,
  organizationId,
  contactEmail,
  children,
  messages,
}: MemberRequiredProps) {
  const auth = useKrakstackAuth();
  const authClient = providedAuthClient ?? auth?.authClient;
  const baseUrl = auth?.baseUrl;
  const authRefreshVersion = auth?.authRefreshVersion ?? 0;
  const locale = auth?.locale;
  const refreshAuth = auth?.refreshAuth;
  if (!authClient) {
    throw new Error("KrakstackAuthProvider is required to use authClient.");
  }

  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const currentAccessKey = accessAtomKey({
    authRefreshVersion,
    baseUrl,
    organizationId,
    userId,
  });
  const [allowedAccessKey, setAllowedAccessKey] = useState<string | null>(null);

  if (allowedAccessKey === currentAccessKey) return <>{children}</>;

  return (
    <MemberRequiredGate
      accessKey={currentAccessKey}
      authClient={authClient}
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
  authClient,
  contactEmail,
  children,
  locale,
  messages,
  onAccessAllowed,
  organizationId,
  refreshAuth,
}: {
  accessKey: string;
  authClient: AuthUiClient;
  contactEmail?: string | undefined;
  children?: ReactNode;
  locale?: KrakstackAuthLocale | undefined;
  messages?: MemberRequiredMessages | undefined;
  onAccessAllowed: () => void;
  organizationId: string;
  refreshAuth?: (() => void) | undefined;
}) {
  const m = labels(locale, messages);
  const accessResult = useAtomSuspense(accessAtom(authClient)(accessKey), {
    suspendOnWaiting: true,
  });
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

  const acceptInvitation = async () => {
    if (!invitation || isInvitationExpired(invitation)) return;
    setAccepting(true);
    setError(null);

    const result = await authClient.organization.acceptInvitation({
      invitationId: invitation.id,
    });

    if (result.error) {
      setAccepting(false);
      setError(result.error.message ?? m.member_required_accept_error);
      return;
    }

    await authClient.organization.setActive({
      organizationId: invitation.organizationId,
    });
    refreshAuth?.();
    onAccessAllowed();
    setAccepting(false);
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
