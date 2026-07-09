// @ts-nocheck
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

const defaultMessages = {
  en: {
    admin_required_title: "Admin access required",
    admin_required_description:
      "You need administrator access to continue.",
    admin_required_org_description:
      "You need access to {organization} before opening the admin area.",
    admin_required_no_permission:
      "Your account is signed in, but it does not have the required admin access.",
    admin_required_invite_found:
      "You have a pending invitation to {organization}. Accept it to continue.",
    admin_required_accept_invite: "Accept invitation",
    admin_required_accepting_invite: "Accepting...",
    admin_required_accept_error: "Could not accept the invitation.",
    admin_required_contact: "Contact organization",
    admin_required_contact_description:
      "If you expected access, contact the organization administrator.",
    admin_required_copy_email: "Copy email",
    admin_required_copied_email: "Copied email",
  },
  fr: {
    admin_required_title: "Accès administrateur requis",
    admin_required_description:
      "Vous devez disposer d'un accès administrateur pour continuer.",
    admin_required_org_description:
      "Vous devez avoir accès à {organization} avant d'ouvrir l'administration.",
    admin_required_no_permission:
      "Votre compte est connecté, mais il ne dispose pas de l'accès administrateur requis.",
    admin_required_invite_found:
      "Vous avez une invitation en attente pour {organization}. Acceptez-la pour continuer.",
    admin_required_accept_invite: "Accepter l'invitation",
    admin_required_accepting_invite: "Acceptation...",
    admin_required_accept_error: "Impossible d'accepter l'invitation.",
    admin_required_contact: "Contacter l'organisation",
    admin_required_contact_description:
      "Si vous pensiez avoir accès, contactez l'administrateur de l'organisation.",
    admin_required_copy_email: "Copier l'e-mail",
    admin_required_copied_email: "E-mail copié",
  },
} as const;

type AdminRequiredLabels = (typeof defaultMessages)["en"];

export type AdminRequiredMessages = Partial<AdminRequiredLabels>;

export type AdminRequiredProps = {
  authClient?: AuthUiClient | undefined;
  organizationId: string;
  contactEmail?: string | undefined;
  children?: ReactNode;
  messages?: AdminRequiredMessages | undefined;
};

type Invitation = Awaited<
  ReturnType<AuthUiClient["organization"]["listUserInvitations"]>
>["data"] extends Array<infer Item>
  ? Item
  : never;
type FullOrganization = {
  id: string;
  name: string;
  slug: string;
  displayName: string;
  contactEmail: string | null;
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
  overrides: AdminRequiredMessages | undefined,
) => ({
  ...(locale === "fr" ? defaultMessages.fr : defaultMessages.en),
  ...overrides,
});

const invitationMatches = (invitation: Invitation, organizationId: string) =>
  invitation.status === "pending" && invitation.organizationId === organizationId;

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
  const response = await fetch(organizationProfileUrl(baseUrl, organizationId), {
    credentials: "include",
  });

  if (!response.ok) return null;
  return (await response.json()) as FullOrganization;
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
    const { baseUrl, isAdmin, organizationId } = JSON.parse(key) as {
      baseUrl?: string | undefined;
      isAdmin: boolean;
      organizationId: string;
      userId?: string | undefined;
    };

    return Atom.keepAlive(
      Atom.make(
        Effect.tryPromise({
          try: async (): Promise<AccessResult> => {
            if (isAdmin) {
              const activeResult = await authClient.organization.setActive({
                organizationId,
              });

              if (!activeResult.error) return { allowed: true };
            }

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
  baseUrl,
  isAdmin,
  organizationId,
  userId,
}: {
  baseUrl?: string | undefined;
  isAdmin: boolean;
  organizationId: string;
  userId?: string | undefined;
}) => JSON.stringify({ baseUrl, isAdmin, organizationId, userId });

export function AdminRequired({
  authClient: providedAuthClient,
  organizationId,
  contactEmail,
  children,
  messages,
}: AdminRequiredProps) {
  const auth = useKrakstackAuth();
  const authClient = providedAuthClient ?? auth?.authClient;
  const baseUrl = auth?.baseUrl;
  const locale = auth?.locale;
  const refreshAuth = auth?.refreshAuth;
  const m = labels(locale, messages);

  if (!authClient) {
    throw new Error("KrakstackAuthProvider is required to use authClient.");
  }

  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const role = session.data?.user.role;
  const isAdmin =
    typeof role === "string" &&
    role.split(",").some((item) => item.trim() === "admin");
  const currentAccessKey = accessAtomKey({
    baseUrl,
    isAdmin,
    organizationId,
    userId,
  });
  const [allowedAccessKey, setAllowedAccessKey] = useState<string | null>(null);

  if (allowedAccessKey === currentAccessKey) return <>{children}</>;

  return (
    <AdminRequiredGate
      accessKey={currentAccessKey}
      authClient={authClient}
      contactEmail={contactEmail}
      isAdmin={isAdmin}
      locale={locale}
      messages={messages}
      onAccessAllowed={() => setAllowedAccessKey(currentAccessKey)}
      organizationId={organizationId}
      refreshAuth={refreshAuth}
    >
      {children}
    </AdminRequiredGate>
  );
}

function AdminRequiredGate({
  accessKey,
  authClient,
  contactEmail,
  children,
  isAdmin,
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
  isAdmin: boolean;
  locale?: KrakstackAuthLocale | undefined;
  messages?: AdminRequiredMessages | undefined;
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

  useEffect(() => {
    if (!access.allowed) return;

    onAccessAllowed();
  }, [access.allowed, onAccessAllowed]);

  if (access.allowed) return <>{children}</>;

  const { invitation, organization } = access;

  const displayName = organizationDisplayName(
    invitation,
    organization,
    organizationId,
  );
  const resolvedContactEmail = organizationContactEmail(organization, contactEmail);

  const acceptInvitation = async () => {
    if (!invitation) return;
    setAccepting(true);
    setError(null);

    const result = await authClient.organization.acceptInvitation({
      invitationId: invitation.id,
    });

    if (result.error) {
      setAccepting(false);
      setError(result.error.message ?? m.admin_required_accept_error);
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
          <CardTitle>{m.admin_required_title}</CardTitle>
          <CardDescription>
            {isAdmin
              ? interpolate(m.admin_required_org_description, {
                  organization: displayName,
                })
              : m.admin_required_no_permission}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {invitation ? (
            <p className="text-muted-foreground text-sm">
              {interpolate(m.admin_required_invite_found, {
                organization: displayName,
              })}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              {m.admin_required_contact_description}
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
                  copy: m.admin_required_copy_email,
                  copied: m.admin_required_copied_email,
                }}
              />
            </div>
          ) : null}
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {invitation ? (
            <Button onClick={acceptInvitation} disabled={accepting}>
              {accepting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {accepting
                ? m.admin_required_accepting_invite
                : m.admin_required_accept_invite}
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </main>
  );
}
