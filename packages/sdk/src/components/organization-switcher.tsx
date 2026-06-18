// @ts-nocheck
import type { ApiKey } from "@better-auth/api-key/client";
import { type ColumnDef } from "@tanstack/react-table";
import { Schema } from "effect";
import {
  Building2,
  Check,
  ChevronsUpDown,
  KeyRound,
  Mail,
  PencilIcon,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  type ComponentProps,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import {
  createDataTableActionsColumn,
  DataTable,
} from "@/components/ui/data-table";
import { EditingLocaleSwitcher } from "@/components/ui/editing-locale-switcher";
import { AppBrand } from "@/components/ui/app-brand";
import { useAppForm } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  OrganizationMetadata,
  type OrganizationLocale,
  type OrganizationTranslation,
} from "@krak-stack/auth/schema";

import type { AuthUiClient } from "./auth-client";

type Locale = "en" | "fr";

const messages = {
  en: {
    api_key_rate_limit_notice:
      "API keys are subject to the same rate limits as your account.",
    organization_contact_email: "Contact email",
    organization_create_description:
      "Create a workspace for team-based access.",
    organization_create_error: "Could not create the organization.",
    organization_create_title: "Create organization",
    organization_edit_description:
      "Update the active organization's canonical details and localized profile.",
    organization_invitation_cancel: "Cancel invitation",
    organization_invitation_cancel_error: "Could not cancel the invitation.",
    organization_invitation_accept: "Accept invitation",
    organization_invitation_accept_error: "Could not accept the invitation.",
    organization_invitation_accepted: "Invitation accepted.",
    organization_invitation_expires: "Expires",
    organization_invitation_organization: "Organization",
    organization_invitation_reject: "Decline invitation",
    organization_invitation_reject_error: "Could not decline the invitation.",
    organization_invitation_rejected: "Invitation declined.",
    organization_invitation_status: "Status",
    organization_invitations_description:
      "Track invitations that have not been accepted yet.",
    organization_invitations_empty: "No pending invitations.",
    organization_invitations_heading: "Pending invitations",
    organization_invitations_load_error:
      "Could not load organization invitations.",
    organization_user_invitations_description:
      "Review invitations sent to your email address and choose which organizations to join.",
    organization_user_invitations_empty: "You have no pending invitations.",
    organization_user_invitations_title: "Organization invitations",
    organization_invite_error: "Could not send the invitation.",
    organization_invite_member_description:
      "Send an invitation to join this organization with the selected role.",
    organization_invite_member_title: "Invite a member",
    organization_loading: "Loading...",
    organization_location: "Location",
    organization_logo: "Logo",
    organization_logo_upload_error: "Could not upload the organization logo.",
    organization_member_email: "Email",
    organization_member_joined: "Joined",
    organization_member_remove: "Remove member",
    organization_member_remove_error: "Could not remove the member.",
    organization_member_role: "Role",
    organization_member_role_error: "Could not update the member role.",
    organization_member_user: "User",
    organization_members_description:
      "Review active members, update roles, and remove access when needed.",
    organization_members_empty: "No members found.",
    organization_members_heading: "Organization members",
    organization_members_load_error: "Could not load organization members.",
    organization_members_title: "Members",
    organization_name: "Organization name",
    organization_role_admin: "Admin",
    organization_role_member: "Member",
    organization_role_owner: "Owner",
    organization_slug: "Organization slug",
    organization_slug_description: "Leave blank to generate one from the name.",
    organization_switcher_empty: "You do not belong to any organizations yet.",
    organization_switcher_label: "Organization",
    organization_switcher_manage: "Manage organization",
    organization_switcher_no_other_organizations: "No other organizations.",
    organization_translation_description:
      "Localized organization details stored in metadata.",
    organization_translation_english: "English profile",
    organization_translation_french: "French profile",
    organization_translation_name: "Localized name",
    organization_update_error: "Could not update the organization.",
    table_empty: "No results.",
    user_api_key_create_error: "Could not create the API key.",
    user_api_key_created_description:
      "Copy this key now. You will not be able to see it again.",
    user_api_key_created_title: "API key created",
    user_api_key_delete_error: "Could not delete the API key.",
    user_api_key_disabled: "Disabled",
    user_api_key_enabled: "Enabled",
    user_api_key_hidden: "Secret hidden",
    user_api_key_name: "Key name",
    user_api_key_starts_with: "Starts with {start}",
    user_api_key_status: "Status",
    user_api_keys_load_error: "Could not load API keys.",
    user_api_keys_title: "API keys",
    user_button_api_keys: "API keys",
    user_delete: "Delete",
    user_loading: "Loading...",
  },
  fr: {
    api_key_rate_limit_notice:
      "Les clés API sont soumises aux mêmes limites de débit que votre compte.",
    organization_contact_email: "E-mail de contact",
    organization_create_description:
      "Créez un espace de travail pour l'accès en équipe.",
    organization_create_error: "Impossible de créer l'organisation.",
    organization_create_title: "Créer une organisation",
    organization_edit_description:
      "Mettez à jour les détails canoniques et le profil localisé de l'organisation active.",
    organization_invitation_cancel: "Annuler l'invitation",
    organization_invitation_cancel_error: "Impossible d'annuler l'invitation.",
    organization_invitation_accept: "Accepter l'invitation",
    organization_invitation_accept_error: "Impossible d'accepter l'invitation.",
    organization_invitation_accepted: "Invitation acceptée.",
    organization_invitation_expires: "Expire le",
    organization_invitation_organization: "Organisation",
    organization_invitation_reject: "Refuser l'invitation",
    organization_invitation_reject_error: "Impossible de refuser l'invitation.",
    organization_invitation_rejected: "Invitation refusée.",
    organization_invitation_status: "Statut",
    organization_invitations_description:
      "Suivez les invitations qui n'ont pas encore été acceptées.",
    organization_invitations_empty: "Aucune invitation en attente.",
    organization_invitations_heading: "Invitations en attente",
    organization_invitations_load_error:
      "Impossible de charger les invitations de l'organisation.",
    organization_user_invitations_description:
      "Consultez les invitations envoyées à votre adresse courriel et choisissez les organisations à rejoindre.",
    organization_user_invitations_empty:
      "Vous n'avez aucune invitation en attente.",
    organization_user_invitations_title: "Invitations d'organisation",
    organization_invite_error: "Impossible d'envoyer l'invitation.",
    organization_invite_member_description:
      "Envoyez une invitation à rejoindre cette organisation avec le rôle sélectionné.",
    organization_invite_member_title: "Inviter un membre",
    organization_loading: "Chargement...",
    organization_location: "Emplacement",
    organization_logo: "Logo",
    organization_logo_upload_error:
      "Impossible de téléverser le logo de l'organisation.",
    organization_member_email: "Courriel",
    organization_member_joined: "Arrivée",
    organization_member_remove: "Retirer le membre",
    organization_member_remove_error: "Impossible de retirer le membre.",
    organization_member_role: "Rôle",
    organization_member_role_error: "Impossible de modifier le rôle du membre.",
    organization_member_user: "Utilisateur",
    organization_members_description:
      "Consultez les membres actifs, modifiez les rôles et retirez les accès au besoin.",
    organization_members_empty: "Aucun membre trouvé.",
    organization_members_heading: "Membres de l'organisation",
    organization_members_load_error:
      "Impossible de charger les membres de l'organisation.",
    organization_members_title: "Membres",
    organization_name: "Nom de l'organisation",
    organization_role_admin: "Admin",
    organization_role_member: "Membre",
    organization_role_owner: "Propriétaire",
    organization_slug: "Slug de l'organisation",
    organization_slug_description:
      "Laissez vide pour en générer un à partir du nom.",
    organization_switcher_empty:
      "Vous n'appartenez encore à aucune organisation.",
    organization_switcher_label: "Organisation",
    organization_switcher_manage: "Gérer l'organisation",
    organization_switcher_no_other_organizations: "Aucune autre organisation.",
    organization_translation_description:
      "Détails localisés de l'organisation stockés dans les métadonnées.",
    organization_translation_english: "Profil anglais",
    organization_translation_french: "Profil français",
    organization_translation_name: "Nom localisé",
    organization_update_error: "Impossible de mettre à jour l'organisation.",
    table_empty: "Aucun résultat.",
    user_api_key_create_error: "Impossible de créer la clé API.",
    user_api_key_created_description:
      "Copiez cette clé maintenant. Vous ne pourrez plus la voir.",
    user_api_key_created_title: "Clé API créée",
    user_api_key_delete_error: "Impossible de supprimer la clé API.",
    user_api_key_disabled: "Désactivée",
    user_api_key_enabled: "Activée",
    user_api_key_hidden: "Secret masqué",
    user_api_key_name: "Nom de la clé",
    user_api_key_starts_with: "Commence par {start}",
    user_api_key_status: "Statut",
    user_api_keys_load_error: "Impossible de charger les clés API.",
    user_api_keys_title: "Clés API",
    user_button_api_keys: "Clés API",
    user_delete: "Supprimer",
    user_loading: "Chargement...",
  },
} as const satisfies Record<Locale, Record<string, string>>;

type OrganizationSwitcherMessageKey = keyof (typeof messages)["en"];
export type OrganizationSwitcherMessages = Partial<
  Record<OrganizationSwitcherMessageKey, string>
>;

const getLocale = (): Locale =>
  (
    globalThis.document?.documentElement.lang ||
    globalThis.navigator?.language ||
    "en"
  )
    .toLowerCase()
    .startsWith("fr")
    ? "fr"
    : "en";

const organizationSwitcherMessages = (
  overrides?: OrganizationSwitcherMessages,
) => ({
  ...(getLocale().startsWith("fr") ? messages.fr : messages.en),
  ...overrides,
});

type OrganizationSwitcherLabels = ReturnType<
  typeof organizationSwitcherMessages
>;

const interpolate = (value: string, params?: Record<string, string | number>) =>
  params
    ? value.replace(/\{([^}]+)\}/g, (_, key: string) =>
        String(params[key] ?? `{${key}}`),
      )
    : value;

const organizationMessageFns = (labels: OrganizationSwitcherLabels) =>
  new Proxy(
    {},
    {
      get:
        (_target, key: string) => (params?: Record<string, string | number>) =>
          interpolate(labels[key as OrganizationSwitcherMessageKey], params),
    },
  ) as Record<
    OrganizationSwitcherMessageKey,
    (params?: Record<string, string | number>) => string
  >;

const OrganizationMessagesContext = createContext(
  organizationMessageFns(organizationSwitcherMessages()),
);
const useOrganizationMessages = () => useContext(OrganizationMessagesContext);

type OrganizationSwitcherProps = {
  authClient: AuthUiClient;
  side?: ComponentProps<typeof DropdownMenuContent>["side"];
  className?: string;
  renderUnauthenticated?: () => ReactNode;
  locked?: boolean;
  messages?: OrganizationSwitcherMessages;
};

type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  metadata?: unknown;
};

type OrganizationDialog =
  | "create"
  | "manage"
  | "members"
  | "apiKeys"
  | "invitations";
type ApiKeySummary = Omit<ApiKey, "key">;
type ActiveOrganization = NonNullable<
  ReturnType<AuthUiClient["useActiveOrganization"]>["data"]
>;
type OrganizationMemberSummary = ActiveOrganization["members"][number];
type OrganizationInvitationSummary = ActiveOrganization["invitations"][number];
type UserInvitationSummary = OrganizationInvitationSummary & {
  organizationName?: string | null;
};
type OrganizationRole = "owner" | "admin" | "member";

type OrganizationFormValues = {
  name: string;
  slug: string;
  enName: string;
  enLogo: File | null;
  enLogoUrl: string;
  enContactEmail: string;
  enLocation: string;
  frName: string;
  frLogo: File | null;
  frLogoUrl: string;
  frContactEmail: string;
  frLocation: string;
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const nullableString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const centralAuthUrl = (path: string) =>
  new URL(path, import.meta.env.VITE_KRAKSTACK_AUTH_URL).toString();

const parsePresignedUpload = (
  value: unknown,
  m: ReturnType<typeof organizationMessageFns>,
) => {
  if (
    !isRecord(value) ||
    typeof value.uploadUrl !== "string" ||
    typeof value.url !== "string"
  ) {
    throw new Error(m.organization_logo_upload_error());
  }

  return { uploadUrl: value.uploadUrl, url: value.url };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const uploadOrganizationLogo = async (
  file: File,
  m: ReturnType<typeof organizationMessageFns>,
) => {
  const contentType = file.type || "image/png";
  const presignResponse = await fetch(
    centralAuthUrl("/api/organizations/logo/presign"),
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType }),
    },
  );

  if (!presignResponse.ok) {
    throw new Error(m.organization_logo_upload_error());
  }

  const presigned = parsePresignedUpload(await presignResponse.json(), m);
  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(m.organization_logo_upload_error());
  }

  return centralAuthUrl(presigned.url);
};

const currentOrganizationLocale = (): OrganizationLocale =>
  getLocale() === "fr" ? "fr" : "en";

const parseOrganizationMetadata = (metadata: unknown): OrganizationMetadata => {
  try {
    return Schema.decodeUnknownSync(OrganizationMetadata)(metadata);
  } catch {
    return { translations: [] };
  }
};

const findOrganizationTranslation = (
  organization: OrganizationSummary,
  locale = currentOrganizationLocale(),
) => {
  const translations = parseOrganizationMetadata(
    organization.metadata,
  ).translations;

  return (
    translations.find((translation) => translation.locale === locale) ??
    translations.find((translation) => translation.locale === "en") ??
    translations[0]
  );
};

const organizationDisplay = (
  organization: OrganizationSummary | null,
  m: ReturnType<typeof organizationMessageFns>,
) => {
  const translation = organization
    ? findOrganizationTranslation(organization)
    : undefined;

  return {
    name:
      translation?.name ||
      organization?.name ||
      m.organization_switcher_label(),
    subtitle: organization?.slug ?? m.organization_switcher_label(),
    logo: translation?.logo || undefined,
  };
};

const organizationFormDefaults = (
  organization?: OrganizationSummary,
): OrganizationFormValues => {
  const translations = parseOrganizationMetadata(
    organization?.metadata,
  ).translations;
  const en = translations.find((translation) => translation.locale === "en");
  const fr = translations.find((translation) => translation.locale === "fr");

  return {
    name: organization?.name ?? "",
    slug: organization?.slug ?? "",
    enName: en?.name || organization?.name || "",
    enLogo: null,
    enLogoUrl: en?.logo ?? "",
    enContactEmail: en?.contactEmail ?? "",
    enLocation: en?.location ?? "",
    frName: fr?.name ?? "",
    frLogo: null,
    frLogoUrl: fr?.logo ?? "",
    frContactEmail: fr?.contactEmail ?? "",
    frLocation: fr?.location ?? "",
  };
};

const organizationLogoFromForm = async (
  file: File | null,
  fallback: string,
  m: ReturnType<typeof organizationMessageFns>,
) => (file ? await uploadOrganizationLogo(file, m) : nullableString(fallback));

const organizationRoles: OrganizationRole[] = ["owner", "admin", "member"];

const normalizeOrganizationRole = (role: string): OrganizationRole =>
  role === "owner" || role === "admin" || role === "member" ? role : "member";

const organizationRoleLabel = (
  role: string,
  m: ReturnType<typeof organizationMessageFns>,
) => {
  switch (normalizeOrganizationRole(role)) {
    case "owner":
      return m.organization_role_owner();
    case "admin":
      return m.organization_role_admin();
    case "member":
      return m.organization_role_member();
  }
};

const formatOrganizationDate = (date: Date | string) =>
  new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium" }).format(
    new Date(date),
  );

const initialsFromName = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

const organizationMetadataFromForm = async (
  value: OrganizationFormValues,
  m: ReturnType<typeof organizationMessageFns>,
): Promise<OrganizationMetadata> => {
  const translations: OrganizationTranslation[] = [];
  const enName = value.enName.trim() || value.name.trim();
  const frName = value.frName.trim();
  const enLogo = await organizationLogoFromForm(
    value.enLogo,
    value.enLogoUrl,
    m,
  );
  const frLogo = await organizationLogoFromForm(
    value.frLogo,
    value.frLogoUrl,
    m,
  );

  if (enName) {
    translations.push({
      locale: "en",
      name: enName,
      logo: enLogo,
      contactEmail: nullableString(value.enContactEmail),
      location: nullableString(value.enLocation),
    });
  }

  if (frName) {
    translations.push({
      locale: "fr",
      name: frName,
      logo: frLogo,
      contactEmail: nullableString(value.frContactEmail),
      location: nullableString(value.frLocation),
    });
  }

  return { translations };
};

export function OrganizationSwitcher({
  authClient,
  side = "bottom",
  className,
  renderUnauthenticated,
  locked = false,
  messages,
}: OrganizationSwitcherProps) {
  const labels = organizationSwitcherMessages(messages);
  const m = organizationMessageFns(labels);
  const session = authClient.useSession();
  const organizations = authClient.useListOrganizations();
  const activeOrganization = authClient.useActiveOrganization();
  const [dialog, setDialog] = useState<OrganizationDialog | null>(null);
  const sessionUserId = session.data?.user.id;
  const [userInvitations, setUserInvitations] = useState<
    UserInvitationSummary[]
  >([]);
  const [userInvitationsError, setUserInvitationsError] = useState<
    string | null
  >(null);
  const [loadingUserInvitations, setLoadingUserInvitations] = useState(false);

  const loadUserInvitations = useEffectEvent(async () => {
    if (!session.data) return;

    setLoadingUserInvitations(true);
    setUserInvitationsError(null);

    const result = await authClient.organization.listUserInvitations({});

    if (result.error) {
      setUserInvitationsError(
        result.error.message ?? m.organization_invitations_load_error(),
      );
      setLoadingUserInvitations(false);
      return;
    }

    setUserInvitations(result.data ?? []);
    setLoadingUserInvitations(false);
  });

  useEffect(() => {
    if (!sessionUserId) return;
    void loadUserInvitations();
  }, [sessionUserId]);

  if (!session.data) {
    return <>{renderUnauthenticated?.()}</>;
  }

  const active = activeOrganization.data;
  const activeName = active?.name;
  const selectableOrganizations = !locked
    ? (organizations.data?.filter(
        (organization) => organization.id !== active?.id,
      ) ?? [])
    : [];
  const hasOrganizationListItems =
    organizations.isPending || Boolean(organizations.error) || !locked;

  const refresh = async () => {
    await organizations.refetch();
    await activeOrganization.refetch();
    await session.refetch();
  };

  const refreshAfterInvitationAction = async (previousActiveId?: string) => {
    await loadUserInvitations();
    await refresh();

    if (locked && previousActiveId) {
      const result = await authClient.organization.setActive({
        organizationId: previousActiveId,
      });

      if (!result.error) await refresh();
    }
  };

  const activeDisplay = organizationDisplay(active ?? null, m);

  return (
    <OrganizationMessagesContext.Provider value={m}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className={cn(
                "h-11 w-full justify-between gap-2 !px-1 !py-0 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:!p-0",
                className,
              )}
            >
              <AppBrand
                to={null}
                label={
                  activeName
                    ? activeDisplay.name
                    : m.organization_switcher_label()
                }
                subtitle={activeDisplay.subtitle}
                icon={Building2}
                variant="sidebar"
                className="min-w-0 flex-1 !p-0 text-left group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-start"
                {...(activeDisplay.logo
                  ? { imageSrc: activeDisplay.logo }
                  : {})}
              />
              <ChevronsUpDown className="text-muted-foreground size-4 shrink-0 group-data-[collapsible=icon]:hidden" />
            </Button>
          }
        />
        <DropdownMenuContent
          className="min-w-64 rounded-lg"
          side={side}
          align="end"
          sideOffset={4}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="p-0 font-normal">
              <AppBrand
                to={null}
                label={activeDisplay.name}
                subtitle={activeDisplay.subtitle}
                icon={Building2}
                variant="sidebar"
                className="px-1 py-1.5 text-left text-sm"
                {...(activeDisplay.logo
                  ? { imageSrc: activeDisplay.logo }
                  : {})}
              />
            </DropdownMenuLabel>
            {hasOrganizationListItems ? <DropdownMenuSeparator /> : null}
            {organizations.isPending ? (
              <DropdownMenuItem disabled>
                {m.organization_loading()}
              </DropdownMenuItem>
            ) : null}
            {organizations.error ? (
              <DropdownMenuItem disabled>
                {organizations.error.message}
              </DropdownMenuItem>
            ) : null}
            {!locked && selectableOrganizations.length ? (
              selectableOrganizations.map((organization) => {
                const display = organizationDisplay(organization, m);

                return (
                  <DropdownMenuItem
                    key={organization.id}
                    onClick={async () => {
                      const result = await authClient.organization.setActive({
                        organizationId: organization.id,
                      });
                      if (!result.error) await refresh();
                    }}
                  >
                    <AppBrand
                      to={null}
                      label={display.name}
                      subtitle={display.subtitle}
                      icon={Building2}
                      className="w-full text-left [&>div:first-child]:size-7"
                      {...(display.logo ? { imageSrc: display.logo } : {})}
                    />
                  </DropdownMenuItem>
                );
              })
            ) : !locked && !organizations.isPending ? (
              <DropdownMenuItem disabled>
                {active
                  ? m.organization_switcher_no_other_organizations()
                  : m.organization_switcher_empty()}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            {!locked ? (
              <DropdownMenuItem onClick={() => setDialog("create")}>
                <Plus />
                {m.organization_create_title()}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onClick={() => {
                setDialog("invitations");
                void loadUserInvitations();
              }}
            >
              <Mail />
              <span className="flex flex-1 items-center justify-between gap-3">
                {m.organization_user_invitations_title()}
                {userInvitations.length ? (
                  <Badge variant="secondary">{userInvitations.length}</Badge>
                ) : null}
              </span>
            </DropdownMenuItem>
            {activeOrganization.data ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDialog("manage")}>
                  <PencilIcon />
                  {m.organization_switcher_manage()}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDialog("members")}>
                  <Users />
                  {m.organization_members_title()}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDialog("apiKeys")}>
                  <KeyRound />
                  {m.user_button_api_keys()}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={dialog === "create"}
        onOpenChange={(open) => {
          setDialog((current) =>
            open ? "create" : current === "create" ? null : current,
          );
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {m.organization_create_title()}
            </DialogTitle>
            <DialogDescription>
              {m.organization_create_description()}
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <CreateOrganizationSection
            authClient={authClient}
            onCreated={async () => {
              await refresh();
              setDialog(null);
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === "manage"}
        onOpenChange={(open) => {
          setDialog((current) =>
            open ? "manage" : current === "manage" ? null : current,
          );
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {m.organization_switcher_manage()}
            </DialogTitle>
            <DialogDescription>
              {m.organization_edit_description()}
            </DialogDescription>
          </DialogHeader>
          <Separator />
          {activeOrganization.data ? (
            <EditOrganizationSection
              authClient={authClient}
              organization={activeOrganization.data}
              onUpdated={refresh}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === "members"}
        onOpenChange={(open) => {
          setDialog((current) =>
            open ? "members" : current === "members" ? null : current,
          );
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {m.organization_members_title()}
            </DialogTitle>
            <DialogDescription>
              {activeOrganization.data?.name}
            </DialogDescription>
          </DialogHeader>
          <Separator />
          {activeOrganization.data ? (
            <OrganizationMembersManager
              authClient={authClient}
              organization={activeOrganization.data}
              currentUserId={session.data.user.id}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === "apiKeys"}
        onOpenChange={(open) => {
          setDialog((current) =>
            open ? "apiKeys" : current === "apiKeys" ? null : current,
          );
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {m.user_api_keys_title()}
            </DialogTitle>
            <DialogDescription>
              {activeOrganization.data?.name}
            </DialogDescription>
          </DialogHeader>
          <Separator />
          {activeOrganization.data ? (
            <OrganizationApiKeyManager
              authClient={authClient}
              organization={activeOrganization.data}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === "invitations"}
        onOpenChange={(open) => {
          setDialog((current) =>
            open ? "invitations" : current === "invitations" ? null : current,
          );
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {m.organization_user_invitations_title()}
            </DialogTitle>
            <DialogDescription>
              {m.organization_user_invitations_description()}
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <UserInvitationsManager
            authClient={authClient}
            invitations={userInvitations}
            loading={loadingUserInvitations}
            error={userInvitationsError}
            activeOrganizationId={activeOrganization.data?.id}
            onActionComplete={refreshAfterInvitationAction}
          />
        </DialogContent>
      </Dialog>
    </OrganizationMessagesContext.Provider>
  );
}

function UserInvitationsManager({
  authClient,
  invitations,
  loading,
  error,
  activeOrganizationId,
  onActionComplete,
}: {
  authClient: AuthUiClient;
  invitations: UserInvitationSummary[];
  loading: boolean;
  error: string | null;
  activeOrganizationId?: string;
  onActionComplete: (previousActiveId?: string) => Promise<void>;
}) {
  const m = useOrganizationMessages();
  const [actingInvitationId, setActingInvitationId] = useState<string | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const acceptInvitation = async (invitation: UserInvitationSummary) => {
    setActingInvitationId(invitation.id);
    setActionError(null);

    const result = await authClient.organization.acceptInvitation({
      invitationId: invitation.id,
    });

    setActingInvitationId(null);

    if (result.error) {
      setActionError(
        result.error.message ?? m.organization_invitation_accept_error(),
      );
      return;
    }

    await onActionComplete(activeOrganizationId);
  };

  const rejectInvitation = async (invitation: UserInvitationSummary) => {
    setActingInvitationId(invitation.id);
    setActionError(null);

    const result = await authClient.organization.rejectInvitation({
      invitationId: invitation.id,
    });

    setActingInvitationId(null);

    if (result.error) {
      setActionError(
        result.error.message ?? m.organization_invitation_reject_error(),
      );
      return;
    }

    await onActionComplete(activeOrganizationId);
  };

  return (
    <section className="flex flex-col gap-4">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {actionError ? (
        <p className="text-destructive text-sm">{actionError}</p>
      ) : null}
      <DataTable
        columns={userInvitationColumns({
          m,
          actingInvitationId,
          onAccept: acceptInvitation,
          onReject: rejectInvitation,
        })}
        data={invitations}
        emptyLabel={
          loading ? m.user_loading() : m.organization_user_invitations_empty()
        }
        exportFileName="organization-invitations.csv"
        features={{ gallery: false }}
      />
    </section>
  );
}

const userInvitationColumns = ({
  m,
  actingInvitationId,
  onAccept,
  onReject,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  actingInvitationId: string | null;
  onAccept: (invitation: UserInvitationSummary) => void;
  onReject: (invitation: UserInvitationSummary) => void;
}): ColumnDef<UserInvitationSummary>[] => [
  {
    accessorKey: "organizationName",
    header: m.organization_invitation_organization(),
    cell: ({ row }) => (
      <div className="flex min-w-48 flex-col gap-1">
        <span className="truncate font-medium">
          {row.original.organizationName ?? row.original.organizationId}
        </span>
        <code className="text-muted-foreground truncate text-xs">
          {row.original.organizationId}
        </code>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: m.organization_member_role(),
    cell: ({ row }) => (
      <Badge variant="secondary">
        {organizationRoleLabel(row.original.role, m)}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: m.organization_invitation_status(),
    cell: ({ row }) => <Badge>{row.original.status}</Badge>,
  },
  {
    accessorKey: "expiresAt",
    header: m.organization_invitation_expires(),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatOrganizationDate(row.original.expiresAt)}
      </span>
    ),
  },
  createDataTableActionsColumn<UserInvitationSummary>([
    {
      name: m.organization_invitation_accept(),
      icon: <Check />,
      visible: (invitation) => actingInvitationId !== invitation.id,
      onClick: onAccept,
    },
    {
      name: m.organization_invitation_reject(),
      icon: <X />,
      variant: "destructive",
      visible: (invitation) => actingInvitationId !== invitation.id,
      onClick: onReject,
    },
  ]),
];

function EditOrganizationSection({
  authClient,
  organization,
  onUpdated,
}: {
  authClient: AuthUiClient;
  organization: OrganizationSummary;
  onUpdated: () => Promise<void>;
}) {
  const m = useOrganizationMessages();
  const [editingLocale, setEditingLocale] = useState<OrganizationLocale>(
    currentOrganizationLocale(),
  );
  const defaultValues = organizationFormDefaults(organization);
  const form = useAppForm({
    defaultValues,
    onSubmit: async ({ value, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });
      const name = value.name.trim();
      const slug = value.slug.trim().toLowerCase();
      const metadata = await organizationMetadataFromForm(value, m);

      const result = await authClient.organization.update({
        organizationId: organization.id,
        data: { name, slug, metadata },
      });

      if (result.error) {
        formApi.setErrorMap({
          onSubmit: {
            form: result.error.message ?? m.organization_update_error(),
            fields: {},
          },
        });
        return;
      }

      await onUpdated();
    },
  });

  return (
    <section className="flex flex-col gap-4">
      <form.AppForm>
        <form
          className="flex max-w-xl flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.AppField name="name">
            {(field) => (
              <field.TextField label={m.organization_name()} required />
            )}
          </form.AppField>
          <form.AppField name="slug">
            {(field) => (
              <field.TextField label={m.organization_slug()} required />
            )}
          </form.AppField>
          <Separator className="my-2" />
          {editingLocale === "en" ? (
            <>
              <OrganizationTranslationHeader
                locale="en"
                editingLocale={editingLocale}
                onEditingLocaleChange={setEditingLocale}
              />
              <form.AppField name="enName">
                {(field) => (
                  <field.TextField
                    label={m.organization_translation_name()}
                    required
                  />
                )}
              </form.AppField>
              <form.AppField name="enLogo">
                {(field) => (
                  <field.ImageField
                    label={m.organization_logo()}
                    defaultImageUrl={defaultValues.enLogoUrl}
                    size={{
                      width: 96,
                      height: 96,
                      suggestedWidth: 512,
                      suggestedHeight: 512,
                    }}
                  />
                )}
              </form.AppField>
              <form.AppField name="enContactEmail">
                {(field) => (
                  <field.TextField
                    label={m.organization_contact_email()}
                    placeholder="team@example.com"
                    type="email"
                  />
                )}
              </form.AppField>
              <form.AppField name="enLocation">
                {(field) => (
                  <field.TextField label={m.organization_location()} />
                )}
              </form.AppField>
            </>
          ) : (
            <>
              <OrganizationTranslationHeader
                locale="fr"
                editingLocale={editingLocale}
                onEditingLocaleChange={setEditingLocale}
              />
              <form.AppField name="frName">
                {(field) => (
                  <field.TextField label={m.organization_translation_name()} />
                )}
              </form.AppField>
              <form.AppField name="frLogo">
                {(field) => (
                  <field.ImageField
                    label={m.organization_logo()}
                    defaultImageUrl={defaultValues.frLogoUrl}
                    size={{
                      width: 96,
                      height: 96,
                      suggestedWidth: 512,
                      suggestedHeight: 512,
                    }}
                  />
                )}
              </form.AppField>
              <form.AppField name="frContactEmail">
                {(field) => (
                  <field.TextField
                    label={m.organization_contact_email()}
                    placeholder="team@example.com"
                    type="email"
                  />
                )}
              </form.AppField>
              <form.AppField name="frLocation">
                {(field) => (
                  <field.TextField label={m.organization_location()} />
                )}
              </form.AppField>
            </>
          )}
          <form.FormError />
          <form.SubmitButton />
        </form>
      </form.AppForm>
    </section>
  );
}

function CreateOrganizationSection({
  authClient,
  onCreated,
}: {
  authClient: AuthUiClient;
  onCreated: () => Promise<void>;
}) {
  const m = useOrganizationMessages();
  const [editingLocale, setEditingLocale] = useState<OrganizationLocale>(
    currentOrganizationLocale(),
  );
  const defaultValues = organizationFormDefaults();
  const form = useAppForm({
    defaultValues,
    onSubmit: async ({ value, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });
      const name = value.name.trim();
      const slug = (value.slug.trim() || slugify(name)).toLowerCase();
      const metadata = await organizationMetadataFromForm(
        {
          ...value,
          name,
          slug,
        },
        m,
      );

      const result = await authClient.organization.create({
        name,
        slug,
        metadata,
      });

      if (result.error) {
        formApi.setErrorMap({
          onSubmit: {
            form: result.error.message ?? m.organization_create_error(),
            fields: {},
          },
        });
        return;
      }

      form.reset();
      await onCreated();
    },
  });

  return (
    <section className="flex flex-col gap-4">
      <form.AppForm>
        <form
          className="flex max-w-xl flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.AppField name="name">
            {(field) => (
              <field.TextField label={m.organization_name()} required />
            )}
          </form.AppField>
          <form.AppField name="slug">
            {(field) => (
              <field.TextField
                label={m.organization_slug()}
                description={m.organization_slug_description()}
              />
            )}
          </form.AppField>
          <Separator className="my-2" />
          {editingLocale === "en" ? (
            <>
              <OrganizationTranslationHeader
                locale="en"
                editingLocale={editingLocale}
                onEditingLocaleChange={setEditingLocale}
              />
              <form.AppField name="enName">
                {(field) => (
                  <field.TextField
                    label={m.organization_translation_name()}
                    required
                  />
                )}
              </form.AppField>
              <form.AppField name="enLogo">
                {(field) => (
                  <field.ImageField
                    label={m.organization_logo()}
                    defaultImageUrl={defaultValues.enLogoUrl}
                    size={{
                      width: 96,
                      height: 96,
                      suggestedWidth: 512,
                      suggestedHeight: 512,
                    }}
                  />
                )}
              </form.AppField>
              <form.AppField name="enContactEmail">
                {(field) => (
                  <field.TextField
                    label={m.organization_contact_email()}
                    placeholder="team@example.com"
                    type="email"
                  />
                )}
              </form.AppField>
              <form.AppField name="enLocation">
                {(field) => (
                  <field.TextField label={m.organization_location()} />
                )}
              </form.AppField>
            </>
          ) : (
            <>
              <OrganizationTranslationHeader
                locale="fr"
                editingLocale={editingLocale}
                onEditingLocaleChange={setEditingLocale}
              />
              <form.AppField name="frName">
                {(field) => (
                  <field.TextField label={m.organization_translation_name()} />
                )}
              </form.AppField>
              <form.AppField name="frLogo">
                {(field) => (
                  <field.ImageField
                    label={m.organization_logo()}
                    defaultImageUrl={defaultValues.frLogoUrl}
                    size={{
                      width: 96,
                      height: 96,
                      suggestedWidth: 512,
                      suggestedHeight: 512,
                    }}
                  />
                )}
              </form.AppField>
              <form.AppField name="frContactEmail">
                {(field) => (
                  <field.TextField
                    label={m.organization_contact_email()}
                    placeholder="team@example.com"
                    type="email"
                  />
                )}
              </form.AppField>
              <form.AppField name="frLocation">
                {(field) => (
                  <field.TextField label={m.organization_location()} />
                )}
              </form.AppField>
            </>
          )}
          <form.FormError />
          <form.SubmitButton />
        </form>
      </form.AppForm>
    </section>
  );
}

function OrganizationTranslationHeader({
  locale,
  editingLocale,
  onEditingLocaleChange,
}: {
  locale: OrganizationLocale;
  editingLocale: OrganizationLocale;
  onEditingLocaleChange: (locale: OrganizationLocale) => void;
}) {
  const m = useOrganizationMessages();
  const title =
    locale === "en"
      ? m.organization_translation_english()
      : m.organization_translation_french();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-muted-foreground text-sm">
          {m.organization_translation_description()}
        </p>
      </div>
      <EditingLocaleSwitcher
        value={editingLocale}
        onValueChange={onEditingLocaleChange}
      />
    </div>
  );
}

function OrganizationMembersManager({
  authClient,
  organization,
  currentUserId,
}: {
  authClient: AuthUiClient;
  organization: OrganizationSummary;
  currentUserId: string;
}) {
  const m = useOrganizationMessages();
  const [members, setMembers] = useState<OrganizationMemberSummary[]>([]);
  const [invitations, setInvitations] = useState<
    OrganizationInvitationSummary[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] = useState<
    string | null
  >(null);

  const loadMembers = useEffectEvent(async () => {
    setLoading(true);
    setError(null);

    const [membersResult, invitationsResult] = await Promise.all([
      authClient.organization.listMembers({
        query: { organizationId: organization.id },
      }),
      authClient.organization.listInvitations({
        query: { organizationId: organization.id },
      }),
    ]);

    if (membersResult.error) {
      setError(
        membersResult.error.message ?? m.organization_members_load_error(),
      );
      setLoading(false);
      return;
    }

    if (invitationsResult.error) {
      setError(
        invitationsResult.error.message ??
          m.organization_invitations_load_error(),
      );
      setLoading(false);
      return;
    }

    setMembers(membersResult.data?.members ?? []);
    setInvitations(invitationsResult.data ?? []);
    setLoading(false);
  });

  useEffect(() => {
    void loadMembers();
  }, [organization.id]);

  const inviteForm = useAppForm({
    defaultValues: { email: "", role: "member" },
    onSubmit: async ({ value, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });
      const result = await authClient.organization.inviteMember({
        email: value.email.trim(),
        role: normalizeOrganizationRole(value.role),
        organizationId: organization.id,
      });

      if (result.error) {
        formApi.setErrorMap({
          onSubmit: {
            form: result.error.message ?? m.organization_invite_error(),
            fields: {},
          },
        });
        return;
      }

      inviteForm.reset();
      await loadMembers();
    },
  });

  const updateRole = async (
    member: OrganizationMemberSummary,
    role: OrganizationRole,
  ) => {
    setUpdatingMemberId(member.id);
    setError(null);

    const result = await authClient.organization.updateMemberRole({
      memberId: member.id,
      role,
      organizationId: organization.id,
    });

    setUpdatingMemberId(null);

    if (result.error) {
      setError(result.error.message ?? m.organization_member_role_error());
      return;
    }

    await loadMembers();
  };

  const removeMember = async (member: OrganizationMemberSummary) => {
    setUpdatingMemberId(member.id);
    setError(null);

    const result = await authClient.organization.removeMember({
      memberIdOrEmail: member.id,
      organizationId: organization.id,
    });

    setUpdatingMemberId(null);

    if (result.error) {
      setError(result.error.message ?? m.organization_member_remove_error());
      return;
    }

    await loadMembers();
  };

  const cancelInvitation = async (
    invitation: OrganizationInvitationSummary,
  ) => {
    setCancellingInvitationId(invitation.id);
    setError(null);

    const result = await authClient.organization.cancelInvitation({
      invitationId: invitation.id,
    });

    setCancellingInvitationId(null);

    if (result.error) {
      setError(
        result.error.message ?? m.organization_invitation_cancel_error(),
      );
      return;
    }

    await loadMembers();
  };

  return (
    <div className="flex flex-col gap-5">
      <inviteForm.AppForm>
        <form
          className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            inviteForm.handleSubmit();
          }}
        >
          <div className="sm:col-span-3">
            <div className="flex items-center gap-2 font-medium">
              <UserPlus className="size-4" />
              {m.organization_invite_member_title()}
            </div>
            <p className="text-muted-foreground text-sm">
              {m.organization_invite_member_description()}
            </p>
          </div>
          <inviteForm.AppField name="email">
            {(field) => (
              <field.TextField
                label={m.organization_member_email()}
                placeholder="teammate@example.com"
                type="email"
                required
              />
            )}
          </inviteForm.AppField>
          <inviteForm.AppField name="role">
            {(field) => (
              <field.SelectField
                label={m.organization_member_role()}
                options={organizationRoles.map((role) => ({
                  label: organizationRoleLabel(role, m),
                  value: role,
                }))}
              />
            )}
          </inviteForm.AppField>
          <div className="self-end">
            <inviteForm.SubmitButton />
          </div>
          <inviteForm.FormError />
        </form>
      </inviteForm.AppForm>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="font-medium">{m.organization_members_heading()}</h3>
          <p className="text-muted-foreground text-sm">
            {m.organization_members_description()}
          </p>
        </div>
        <DataTable
          columns={memberColumns({
            m,
            currentUserId,
            updatingMemberId,
            onRemove: removeMember,
            onRoleChange: updateRole,
          })}
          data={members}
          emptyLabel={
            loading ? m.user_loading() : m.organization_members_empty()
          }
          exportFileName={`${organization.slug}-members.csv`}
          features={{ gallery: false }}
        />
      </section>
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="font-medium">
            {m.organization_invitations_heading()}
          </h3>
          <p className="text-muted-foreground text-sm">
            {m.organization_invitations_description()}
          </p>
        </div>
        <DataTable
          columns={invitationColumns({
            m,
            cancellingInvitationId,
            onCancel: cancelInvitation,
          })}
          data={invitations}
          emptyLabel={
            loading ? m.user_loading() : m.organization_invitations_empty()
          }
          exportFileName={`${organization.slug}-invitations.csv`}
          features={{ gallery: false }}
        />
      </section>
    </div>
  );
}

const memberColumns = ({
  m,
  currentUserId,
  updatingMemberId,
  onRemove,
  onRoleChange,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  currentUserId: string;
  updatingMemberId: string | null;
  onRemove: (member: OrganizationMemberSummary) => void;
  onRoleChange: (
    member: OrganizationMemberSummary,
    role: OrganizationRole,
  ) => void;
}): ColumnDef<OrganizationMemberSummary>[] => [
  {
    id: "user",
    header: m.organization_member_user(),
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        {row.original.user.image ? (
          <img
            src={row.original.user.image}
            alt={row.original.user.name}
            className="size-9 shrink-0 rounded-full border object-cover"
          />
        ) : (
          <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">
            {initialsFromName(row.original.user.name)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.user.name}</p>
          <p className="text-muted-foreground truncate text-sm">
            {row.original.user.email}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: m.organization_member_role(),
    cell: ({ row }) => {
      const member = row.original;
      const disabled = updatingMemberId === member.id;

      return (
        <Select
          items={organizationRoles.map((role) => ({
            label: organizationRoleLabel(role, m),
            value: role,
          }))}
          value={normalizeOrganizationRole(member.role)}
          onValueChange={(value) => {
            if (value === "owner" || value === "admin" || value === "member") {
              onRoleChange(member, value);
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger
            className="w-36"
            onClick={(event) => event.stopPropagation()}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {organizationRoles.map((role) => (
              <SelectItem key={role} value={role}>
                {organizationRoleLabel(role, m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: m.organization_member_joined(),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatOrganizationDate(row.original.createdAt)}
      </span>
    ),
  },
  createDataTableActionsColumn<OrganizationMemberSummary>([
    {
      name: m.organization_member_remove(),
      icon: <Trash2 />,
      variant: "destructive",
      visible: (member) => member.userId !== currentUserId,
      onClick: onRemove,
    },
  ]),
];

const invitationColumns = ({
  m,
  cancellingInvitationId,
  onCancel,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  cancellingInvitationId: string | null;
  onCancel: (invitation: OrganizationInvitationSummary) => void;
}): ColumnDef<OrganizationInvitationSummary>[] => [
  {
    accessorKey: "email",
    header: m.organization_member_email(),
    cell: ({ row }) => (
      <p className="truncate font-medium">{row.original.email}</p>
    ),
  },
  {
    accessorKey: "role",
    header: m.organization_member_role(),
    cell: ({ row }) => (
      <Badge variant="secondary">
        {organizationRoleLabel(row.original.role, m)}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: m.organization_invitation_status(),
    cell: ({ row }) => <Badge>{row.original.status}</Badge>,
  },
  {
    accessorKey: "expiresAt",
    header: m.organization_invitation_expires(),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatOrganizationDate(row.original.expiresAt)}
      </span>
    ),
  },
  createDataTableActionsColumn<OrganizationInvitationSummary>([
    {
      name: m.organization_invitation_cancel(),
      icon: <Trash2 />,
      variant: "destructive",
      visible: (invitation) => cancellingInvitationId !== invitation.id,
      onClick: onCancel,
    },
  ]),
];

function OrganizationApiKeyManager({
  authClient,
  organization,
}: {
  authClient: AuthUiClient;
  organization: OrganizationSummary;
}) {
  const m = useOrganizationMessages();
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadKeys = useEffectEvent(async () => {
    setLoading(true);
    setError(null);
    const result = await authClient.apiKey.list({
      query: { configId: "organization", organizationId: organization.id },
    });

    if (result.error) {
      setError(result.error.message ?? m.user_api_keys_load_error());
      setLoading(false);
      return;
    }

    setKeys(result.data?.apiKeys ?? []);
    setLoading(false);
  });

  useEffect(() => {
    void loadKeys();
  }, [organization.id]);

  const createForm = useAppForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });
      setCreatedKey(null);
      const result = await authClient.apiKey.create({
        configId: "organization",
        organizationId: organization.id,
        name: value.name.trim(),
      });

      if (result.error || !result.data) {
        formApi.setErrorMap({
          onSubmit: {
            form: result.error?.message ?? m.user_api_key_create_error(),
            fields: {},
          },
        });
        return;
      }

      setCreatedKey(result.data.key);
      createForm.reset();
      await loadKeys();
    },
  });

  const deleteKey = async (key: ApiKeySummary) => {
    const result = await authClient.apiKey.delete({
      configId: "organization",
      keyId: key.id,
    });

    if (result.error) {
      setError(result.error.message ?? m.user_api_key_delete_error());
      return;
    }

    await loadKeys();
  };

  return (
    <div className="flex flex-col gap-5">
      <createForm.AppForm>
        <form
          className="flex max-w-xl flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            createForm.handleSubmit();
          }}
        >
          <p className="text-muted-foreground text-sm">
            {m.api_key_rate_limit_notice()}
          </p>
          <createForm.AppField name="name">
            {(field) => (
              <field.TextField label={m.user_api_key_name()} required />
            )}
          </createForm.AppField>
          <createForm.FormError />
          <createForm.SubmitButton />
        </form>
      </createForm.AppForm>
      {createdKey ? (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex items-center gap-2 font-medium">
            <KeyRound />
            {m.user_api_key_created_title()}
          </div>
          <p className="text-muted-foreground text-sm">
            {m.user_api_key_created_description()}
          </p>
          <code className="bg-muted overflow-x-auto rounded-md p-3 text-sm">
            {createdKey}
          </code>
        </div>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Separator />
      <DataTable
        columns={apiKeyColumns({ m, onDelete: deleteKey })}
        data={keys}
        emptyLabel={loading ? m.user_loading() : m.table_empty()}
        exportFileName={`${organization.slug}-api-keys.csv`}
        features={{ gallery: false }}
      />
    </div>
  );
}

const apiKeyColumns = ({
  m,
  onDelete,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  onDelete: (key: ApiKeySummary) => void;
}): ColumnDef<ApiKeySummary>[] => [
  {
    accessorKey: "name",
    header: m.user_api_key_name(),
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.name}</p>
        <p className="text-muted-foreground text-sm">
          {row.original.start
            ? m.user_api_key_starts_with({ start: row.original.start })
            : m.user_api_key_hidden()}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "enabled",
    header: m.user_api_key_status(),
    cell: ({ row }) => (
      <Badge variant={row.original.enabled ? "default" : "secondary"}>
        {row.original.enabled
          ? m.user_api_key_enabled()
          : m.user_api_key_disabled()}
      </Badge>
    ),
  },
  createDataTableActionsColumn<ApiKeySummary>([
    {
      name: m.user_delete(),
      icon: <Trash2 />,
      variant: "destructive",
      onClick: onDelete,
    },
  ]),
];
