// @ts-nocheck
import type { ApiKey } from "@better-auth/api-key/client";
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { useStore } from "@tanstack/react-form";
import { type ColumnDef } from "@tanstack/react-table";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Copy,
  KeyRound,
  Mail,
  PencilIcon,
  Plus,
  Trash2,
  UserIcon,
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
  useState,
} from "react";

import { DataTable } from "@/components/ui/data-table";
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
import {
  OrganizationMetadata,
  type OrganizationLocale,
  type OrganizationTranslation,
} from "@krak-stack/auth/schema";

import type { AuthUiClient } from "./auth-client";
import { authClientApi } from "./auth-client-api";
import { useAuthClient } from "./auth-provider";
import { createApiKey } from "./api-key";
import { useOpenedOnce } from "./hooks";
import { ExtraUploadedAsset } from "../extra/schema";
import { assetPath, assetUrl, cn } from "./utils";

type Locale = "en" | "fr";

const messages = {
  en: {
    api_key_rate_limit_notice:
      "API keys are subject to the same rate limits as your account.",
    organization_contact_email: "Contact email",
    organization_create_description:
      "Create a workspace for team-based access.",
    organization_create_error: "Could not create the organization.",
    organization_copy_id: "Copy organization ID",
    organization_create_slug_conflict:
      "That organization slug is already in use. Choose a different slug.",
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
    organization_icon: "Icon",
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
    organization_copy_id: "Copier l'ID de l'organisation",
    organization_create_slug_conflict:
      "Ce slug d'organisation est déjà utilisé. Choisissez un autre slug.",
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
    organization_icon: "Icône",
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
  authClient?: AuthUiClient;
  baseUrl?: string | undefined;
  side?: ComponentProps<typeof DropdownMenuContent>["side"];
  className?: string;
  defaultDialog?: OrganizationSwitcherDialog | null;
  hideTrigger?: boolean;
  renderUnauthenticated?: () => ReactNode;
  locked?: boolean;
  messages?: OrganizationSwitcherMessages;
  dialog?: OrganizationSwitcherDialog | null;
  onChange?: (organization: OrganizationSummary | null) => void;
  onCreate?: (organization: OrganizationSummary) => void;
  onDialogChange?: (dialog: OrganizationSwitcherDialog | null) => void;
};

type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  metadata?: unknown;
};

export type OrganizationSwitcherDialog =
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

type OrganizationMembersData = {
  members: OrganizationMemberSummary[];
  invitations: OrganizationInvitationSummary[];
};

const userInvitationsAtom = Atom.family((authClient: AuthUiClient) =>
  Atom.keepAlive(
    Atom.make(
      Effect.tryPromise({
        try: async () => {
          const result = await authClient.organization.listUserInvitations({});

          if (result.error) {
            throw new Error(
              result.error.message ??
                "Could not load organization invitations.",
            );
          }

          return result.data ?? [];
        },
        catch: (error) => error,
      }),
    ),
  ),
);

const emptyUserInvitationsAtom = Atom.make(
  Effect.succeed([] as UserInvitationSummary[]),
);

const organizationMembersAtom = Atom.family((authClient: AuthUiClient) =>
  Atom.family((organizationId: string) =>
    Atom.keepAlive(
      Atom.make(
        Effect.tryPromise({
          try: async (): Promise<OrganizationMembersData> => {
            const [membersResult, invitationsResult] = await Promise.all([
              authClient.organization.listMembers({
                query: { organizationId },
              }),
              authClient.organization.listInvitations({
                query: { organizationId },
              }),
            ]);

            if (membersResult.error) {
              throw new Error(
                membersResult.error.message ?? "Could not load members.",
              );
            }

            if (invitationsResult.error) {
              throw new Error(
                invitationsResult.error.message ??
                  "Could not load invitations.",
              );
            }

            return {
              members: membersResult.data?.members ?? [],
              invitations: invitationsResult.data ?? [],
            };
          },
          catch: (error) => error,
        }),
      ),
    ),
  ),
);

const emptyOrganizationMembersAtom = Atom.make(
  Effect.succeed({ members: [], invitations: [] } as OrganizationMembersData),
);

const organizationApiKeysAtom = Atom.family((authClient: AuthUiClient) =>
  Atom.family((organizationId: string) =>
    Atom.keepAlive(
      Atom.make(
        Effect.tryPromise({
          try: async () => {
            const result = await authClient.apiKey.list({
              query: { configId: "organization", organizationId },
            });

            if (result.error) {
              throw new Error(
                result.error.message ?? "Could not load API keys.",
              );
            }

            return result.data?.apiKeys ?? [];
          },
          catch: (error) => error,
        }),
      ),
    ),
  ),
);

const emptyOrganizationApiKeysAtom = Atom.make(
  Effect.succeed([] as ApiKeySummary[]),
);

type OrganizationFormValues = {
  name: string;
  slug: string;
  enName: string;
  enLogo: File | string | null;
  enIcon: File | string | null;
  enContactEmail: string;
  enLocation: string;
  frName: string;
  frLogo: File | string | null;
  frIcon: File | string | null;
  frContactEmail: string;
  frLocation: string;
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isOrganizationSlugConflict = (error: unknown) => {
  if (typeof error !== "object" || error === null) return false;

  const code = Reflect.get(error, "code");
  const message = Reflect.get(error, "message");

  return [code, message].some((value) => {
    if (typeof value !== "string") return false;
    const normalized = value.toLowerCase().replaceAll("_", " ");

    return normalized.includes("organization already exists");
  });
};

const nullableString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const decodeUploadedAsset = Schema.decodeUnknownPromise(ExtraUploadedAsset);

const uploadImageAsset = async (
  file: File,
  m: ReturnType<typeof organizationMessageFns>,
  uploadImage: (input: { payload: FormData }) => Promise<unknown>,
) => {
  const payload = new FormData();
  payload.append("file", file);

  try {
    const uploaded = await decodeUploadedAsset(await uploadImage({ payload }));

    return assetPath(uploaded.url);
  } catch {
    throw new Error(m.organization_logo_upload_error());
  }
};

const currentOrganizationLocale = (): OrganizationLocale =>
  getLocale() === "fr" ? "fr" : "en";

const parseOrganizationMetadata = (metadata: unknown): OrganizationMetadata => {
  try {
    const value =
      typeof metadata === "string" ? JSON.parse(metadata) : metadata;

    return Schema.decodeUnknownSync(OrganizationMetadata)(value);
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
  baseUrl?: string,
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
    image: assetUrl(translation?.icon || translation?.logo, baseUrl),
  };
};

const organizationFormDefaults = (
  organization?: OrganizationSummary,
  baseUrl?: string,
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
    enLogo: assetUrl(en?.logo, baseUrl) || null,
    enIcon: assetUrl(en?.icon, baseUrl) || null,
    enContactEmail: en?.contactEmail ?? "",
    enLocation: en?.location ?? "",
    frName: fr?.name ?? "",
    frLogo: assetUrl(fr?.logo, baseUrl) || null,
    frIcon: assetUrl(fr?.icon, baseUrl) || null,
    frContactEmail: fr?.contactEmail ?? "",
    frLocation: fr?.location ?? "",
  };
};

const organizationLogoFromForm = async (
  value: File | string | null,
  m: ReturnType<typeof organizationMessageFns>,
  uploadImage: (input: { payload: FormData }) => Promise<unknown>,
) => {
  if (value instanceof File)
    return await uploadImageAsset(value, m, uploadImage);
  if (typeof value === "string") return assetPath(value);
  return null;
};

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

const organizationMetadataFromForm = async (
  value: OrganizationFormValues,
  m: ReturnType<typeof organizationMessageFns>,
  uploadImage: (input: { payload: FormData }) => Promise<unknown>,
): Promise<OrganizationMetadata> => {
  const translations: OrganizationTranslation[] = [];
  const enName = value.enName.trim() || value.name.trim();
  const frName = value.frName.trim();
  const enLogo = await organizationLogoFromForm(value.enLogo, m, uploadImage);
  const enIcon = await organizationLogoFromForm(value.enIcon, m, uploadImage);
  const frLogo = await organizationLogoFromForm(value.frLogo, m, uploadImage);
  const frIcon = await organizationLogoFromForm(value.frIcon, m, uploadImage);

  if (enName) {
    translations.push({
      locale: "en",
      name: enName,
      logo: enLogo,
      icon: enIcon,
      contactEmail: nullableString(value.enContactEmail),
      location: nullableString(value.enLocation),
    });
  }

  if (frName) {
    translations.push({
      locale: "fr",
      name: frName,
      logo: frLogo,
      icon: frIcon,
      contactEmail: nullableString(value.frContactEmail),
      location: nullableString(value.frLocation),
    });
  }

  return { translations };
};

export function OrganizationSwitcher({
  authClient: providedAuthClient,
  baseUrl,
  side = "bottom",
  className,
  defaultDialog = null,
  hideTrigger = false,
  renderUnauthenticated,
  locked = false,
  messages,
  dialog: controlledDialog,
  onChange,
  onCreate,
  onDialogChange,
}: OrganizationSwitcherProps) {
  const contextAuthClient = useAuthClient();
  const authClient = providedAuthClient ?? contextAuthClient;

  const labels = organizationSwitcherMessages(messages);
  const m = organizationMessageFns(labels);
  const session = authClient.useSession();
  const organizations = authClient.useListOrganizations();
  const activeOrganization = authClient.useActiveOrganization();
  const [uncontrolledDialog, setUncontrolledDialog] =
    useState<OrganizationSwitcherDialog | null>(defaultDialog);
  const dialog =
    controlledDialog !== undefined ? controlledDialog : uncontrolledDialog;
  const invitationsAtom = session.data
    ? userInvitationsAtom(authClient)
    : emptyUserInvitationsAtom;
  const invitationsResult = useAtomValue(invitationsAtom);
  const refreshUserInvitations = useAtomRefresh(invitationsAtom);
  const userInvitations = AsyncResult.match(invitationsResult, {
    onInitial: () => [],
    onFailure: () => [],
    onSuccess: ({ value }) => Array.from(value),
  });
  const userInvitationsError = AsyncResult.match(invitationsResult, {
    onInitial: () => null,
    onFailure: () => m.organization_invitations_load_error(),
    onSuccess: () => null,
  });
  const loadingUserInvitations = invitationsResult._tag === "Initial";

  const setDialog = (
    next:
      | OrganizationSwitcherDialog
      | null
      | ((
          current: OrganizationSwitcherDialog | null,
        ) => OrganizationSwitcherDialog | null),
  ) => {
    const nextDialog = typeof next === "function" ? next(dialog) : next;

    if (nextDialog === dialog) return;
    if (controlledDialog === undefined) setUncontrolledDialog(nextDialog);
    onDialogChange?.(nextDialog);
  };
  const openCreate = () => setDialog("create");

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
    refreshUserInvitations();
    await refresh();

    if (locked && previousActiveId) {
      const result = await authClient.organization.setActive({
        organizationId: previousActiveId,
      });

      if (!result.error) {
        await refresh();
        onChange?.(
          organizations.data?.find(
            (organization) => organization.id === previousActiveId,
          ) ?? null,
        );
      }
    }
  };

  const activeDisplay = organizationDisplay(active ?? null, m, baseUrl);

  return (
    <OrganizationMessagesContext.Provider value={m}>
      {hideTrigger ? null : (
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
                  {...(activeDisplay.image
                    ? { imageSrc: activeDisplay.image }
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
                  {...(activeDisplay.image
                    ? { imageSrc: activeDisplay.image }
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
                  const display = organizationDisplay(organization, m, baseUrl);

                  return (
                    <DropdownMenuItem
                      key={organization.id}
                      onClick={async () => {
                        const result = await authClient.organization.setActive({
                          organizationId: organization.id,
                        });
                        if (!result.error) {
                          await refresh();
                          onChange?.(organization);
                        }
                      }}
                    >
                      <AppBrand
                        to={null}
                        label={display.name}
                        subtitle={display.subtitle}
                        icon={Building2}
                        className="w-full text-left [&>div:first-child]:size-7"
                        {...(display.image ? { imageSrc: display.image } : {})}
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
                <DropdownMenuItem onClick={openCreate}>
                  <Plus />
                  {m.organization_create_title()}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() => {
                  setDialog("invitations");
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
                  <DropdownMenuItem
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        activeOrganization.data.id,
                      );
                    }}
                  >
                    <Copy />
                    {m.organization_copy_id()}
                  </DropdownMenuItem>
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
      )}
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
            baseUrl={baseUrl}
            onCreated={async (organization) => {
              setDialog(null);
              const activeResult = await authClient.organization.setActive({
                organizationId: organization.id,
              });
              await refresh();
              if (!activeResult.error) {
                onCreate?.(organization);
                onChange?.(organization);
              }
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
              baseUrl={baseUrl}
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
        <DialogContent className="max-h-[85vh] overflow-x-hidden overflow-y-auto sm:max-w-4xl">
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
              baseUrl={baseUrl}
              organization={activeOrganization.data}
              currentUserId={session.data.user.id}
              active={dialog === "members"}
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
              active={dialog === "apiKeys"}
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
        })}
        data={invitations}
        emptyLabel={
          loading ? m.user_loading() : m.organization_user_invitations_empty()
        }
        exportFileName="organization-invitations.csv"
        features={{ gallery: false }}
        rowActions={userInvitationRowActions({
          m,
          actingInvitationId,
          onAccept: acceptInvitation,
          onReject: rejectInvitation,
        })}
      />
    </section>
  );
}

const userInvitationColumns = ({
  m,
}: {
  m: ReturnType<typeof organizationMessageFns>;
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
];

const userInvitationRowActions = ({
  m,
  actingInvitationId,
  onAccept,
  onReject,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  actingInvitationId: string | null;
  onAccept: (invitation: UserInvitationSummary) => void;
  onReject: (invitation: UserInvitationSummary) => void;
}) => [
  {
    name: m.organization_invitation_accept(),
    icon: <Check />,
    visible: (invitation: UserInvitationSummary) =>
      actingInvitationId !== invitation.id,
    onClick: onAccept,
  },
  {
    name: m.organization_invitation_reject(),
    icon: <X />,
    variant: "destructive" as const,
    visible: (invitation: UserInvitationSummary) =>
      actingInvitationId !== invitation.id,
    onClick: onReject,
  },
];

function EditOrganizationSection({
  authClient,
  baseUrl,
  organization,
  onUpdated,
}: {
  authClient: AuthUiClient;
  baseUrl?: string | undefined;
  organization: OrganizationSummary;
  onUpdated: () => Promise<void>;
}) {
  const m = useOrganizationMessages();
  const uploadImage = useAtomSet(
    authClientApi(baseUrl).mutation("authExtra", "uploadUserImage"),
    { mode: "promise" },
  );
  const [editingLocale, setEditingLocale] = useState<OrganizationLocale>(
    currentOrganizationLocale(),
  );
  const defaultValues = organizationFormDefaults(organization, baseUrl);
  const form = useAppForm({
    defaultValues,
    onSubmit: async ({ value, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });
      try {
        const name = value.name.trim();
        const slug = value.slug.trim().toLowerCase();
        const metadata = await organizationMetadataFromForm(
          value,
          m,
          uploadImage,
        );

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
      } catch (cause) {
        formApi.setErrorMap({
          onSubmit: {
            form:
              cause instanceof Error
                ? cause.message
                : m.organization_update_error(),
            fields: {},
          },
        });
      }
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
                    size={{
                      width: 175,
                      height: 50,
                      suggestedWidth: 350,
                      suggestedHeight: 100,
                    }}
                  />
                )}
              </form.AppField>
              <form.AppField name="enIcon">
                {(field) => (
                  <field.ImageField
                    label={m.organization_icon()}
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
                    size={{
                      width: 175,
                      height: 50,
                      suggestedWidth: 350,
                      suggestedHeight: 100,
                    }}
                  />
                )}
              </form.AppField>
              <form.AppField name="frIcon">
                {(field) => (
                  <field.ImageField
                    label={m.organization_icon()}
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

function CreateOrganizationSlugAutoFill({
  form,
}: {
  form: ReturnType<typeof useAppForm>;
}) {
  const name = useStore(form.store, (state) => state.values.name);
  const slugIsDirty = useStore(
    form.store,
    (state) => state.fieldMeta.slug?.isDirty ?? false,
  );

  useEffect(() => {
    if (!slugIsDirty) {
      form.setFieldValue("slug", slugify(name), { dontUpdateMeta: true });
    }
  }, [form, name, slugIsDirty]);

  return null;
}

function CreateOrganizationSection({
  authClient,
  baseUrl,
  onCreated,
}: {
  authClient: AuthUiClient;
  baseUrl?: string | undefined;
  onCreated: (organization: OrganizationSummary) => Promise<void>;
}) {
  const m = useOrganizationMessages();
  const uploadImage = useAtomSet(
    authClientApi(baseUrl).mutation("authExtra", "uploadUserImage"),
    { mode: "promise" },
  );
  const [editingLocale, setEditingLocale] = useState<OrganizationLocale>(
    currentOrganizationLocale(),
  );
  const defaultValues = organizationFormDefaults(undefined, baseUrl);
  const form = useAppForm({
    defaultValues,
    onSubmit: async ({ value, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });
      try {
        const name = value.name.trim();
        const slug = (value.slug.trim() || slugify(name)).toLowerCase();
        const metadata = await organizationMetadataFromForm(
          {
            ...value,
            name,
            slug,
          },
          m,
          uploadImage,
        );

        const result = await authClient.organization.create({
          name,
          slug,
          metadata,
        });

        if (result.error) {
          if (isOrganizationSlugConflict(result.error)) {
            formApi.setErrorMap({
              onSubmit: {
                fields: {
                  slug: { message: m.organization_create_slug_conflict() },
                },
              },
            });
            return;
          }

          formApi.setErrorMap({
            onSubmit: {
              form: result.error.message ?? m.organization_create_error(),
              fields: {},
            },
          });
          return;
        }

        form.reset();
        await onCreated(result.data);
      } catch (cause) {
        formApi.setErrorMap({
          onSubmit: {
            form:
              cause instanceof Error
                ? cause.message
                : m.organization_create_error(),
            fields: {},
          },
        });
      }
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
          <CreateOrganizationSlugAutoFill form={form} />
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
                    size={{
                      width: 175,
                      height: 50,
                      suggestedWidth: 350,
                      suggestedHeight: 100,
                    }}
                  />
                )}
              </form.AppField>
              <form.AppField name="enIcon">
                {(field) => (
                  <field.ImageField
                    label={m.organization_icon()}
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
                    size={{
                      width: 175,
                      height: 50,
                      suggestedWidth: 350,
                      suggestedHeight: 100,
                    }}
                  />
                )}
              </form.AppField>
              <form.AppField name="frIcon">
                {(field) => (
                  <field.ImageField
                    label={m.organization_icon()}
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
  baseUrl,
  organization,
  currentUserId,
  active,
}: {
  authClient: AuthUiClient;
  baseUrl?: string | undefined;
  organization: OrganizationSummary;
  currentUserId: string;
  active: boolean;
}) {
  const m = useOrganizationMessages();
  const hasOpened = useOpenedOnce(active);
  const membersAtom = hasOpened
    ? organizationMembersAtom(authClient)(organization.id)
    : emptyOrganizationMembersAtom;
  const membersResult = useAtomValue(membersAtom);
  const refreshMembers = useAtomRefresh(membersAtom);
  const [error, setError] = useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] = useState<
    string | null
  >(null);
  const membersData = AsyncResult.match(membersResult, {
    onInitial: () => ({ members: [], invitations: [] }),
    onFailure: () => ({ members: [], invitations: [] }),
    onSuccess: ({ value }) => value,
  });
  const members = membersData.members;
  const invitations = membersData.invitations;
  const membersError = AsyncResult.match(membersResult, {
    onInitial: () => null,
    onFailure: () => m.organization_members_load_error(),
    onSuccess: () => null,
  });
  const loading = membersResult._tag === "Initial";

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
      refreshMembers();
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

    refreshMembers();
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

    refreshMembers();
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

    refreshMembers();
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
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
      {membersError ? (
        <p className="text-destructive text-sm">{membersError}</p>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <section className="flex min-w-0 flex-col gap-3">
        <div>
          <h3 className="font-medium">{m.organization_members_heading()}</h3>
          <p className="text-muted-foreground text-sm">
            {m.organization_members_description()}
          </p>
        </div>
        <div className="min-w-0 overflow-x-auto">
          <DataTable
            columns={memberColumns({
              m,
              baseUrl,
              updatingMemberId,
              onRoleChange: updateRole,
            })}
            data={members}
            emptyLabel={
              loading ? m.user_loading() : m.organization_members_empty()
            }
            exportFileName={`${organization.slug}-members.csv`}
            features={{ gallery: false }}
            rowActions={memberRowActions({
              m,
              currentUserId,
              onRemove: removeMember,
            })}
          />
        </div>
      </section>
      <section className="flex min-w-0 flex-col gap-3">
        <div>
          <h3 className="font-medium">
            {m.organization_invitations_heading()}
          </h3>
          <p className="text-muted-foreground text-sm">
            {m.organization_invitations_description()}
          </p>
        </div>
        <div className="min-w-0 overflow-x-auto">
          <DataTable
            columns={invitationColumns({
              m,
            })}
            data={invitations}
            emptyLabel={
              loading ? m.user_loading() : m.organization_invitations_empty()
            }
            exportFileName={`${organization.slug}-invitations.csv`}
            features={{ gallery: false }}
            rowActions={invitationRowActions({
              m,
              cancellingInvitationId,
              onCancel: cancelInvitation,
            })}
          />
        </div>
      </section>
    </div>
  );
}

const memberColumns = ({
  m,
  baseUrl,
  updatingMemberId,
  onRoleChange,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  baseUrl?: string | undefined;
  updatingMemberId: string | null;
  onRoleChange: (
    member: OrganizationMemberSummary,
    role: OrganizationRole,
  ) => void;
}): ColumnDef<OrganizationMemberSummary>[] => [
  {
    id: "user",
    header: m.organization_member_user(),
    cell: ({ row }) => {
      const image = assetUrl(row.original.user.image, baseUrl);

      return (
        <AppBrand
          to={null}
          label={row.original.user.name}
          subtitle={row.original.user.email}
          icon={UserIcon}
          className="min-w-0"
          {...(image ? { imageSrc: image } : {})}
        />
      );
    },
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
];

const memberRowActions = ({
  m,
  currentUserId,
  onRemove,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  currentUserId: string;
  onRemove: (member: OrganizationMemberSummary) => void;
}) => [
  {
    name: m.organization_member_remove(),
    icon: <Trash2 />,
    variant: "destructive" as const,
    visible: (member: OrganizationMemberSummary) =>
      member.userId !== currentUserId,
    onClick: onRemove,
  },
];

const invitationColumns = ({
  m,
}: {
  m: ReturnType<typeof organizationMessageFns>;
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
];

const invitationRowActions = ({
  m,
  cancellingInvitationId,
  onCancel,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  cancellingInvitationId: string | null;
  onCancel: (invitation: OrganizationInvitationSummary) => void;
}) => [
  {
    name: m.organization_invitation_cancel(),
    icon: <Trash2 />,
    variant: "destructive" as const,
    visible: (invitation: OrganizationInvitationSummary) =>
      cancellingInvitationId !== invitation.id,
    onClick: onCancel,
  },
];

function OrganizationApiKeyManager({
  authClient,
  organization,
  active,
}: {
  authClient: AuthUiClient;
  organization: OrganizationSummary;
  active: boolean;
}) {
  const m = useOrganizationMessages();
  const hasOpened = useOpenedOnce(active);
  const keysAtom = hasOpened
    ? organizationApiKeysAtom(authClient)(organization.id)
    : emptyOrganizationApiKeysAtom;
  const keysResult = useAtomValue(keysAtom);
  const refreshKeys = useAtomRefresh(keysAtom);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keys = AsyncResult.match(keysResult, {
    onInitial: () => [],
    onFailure: () => [],
    onSuccess: ({ value }) => Array.from(value),
  });
  const keysError = AsyncResult.match(keysResult, {
    onInitial: () => null,
    onFailure: () => m.user_api_keys_load_error(),
    onSuccess: () => null,
  });
  const loading = keysResult._tag === "Initial";

  const createForm = useAppForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });
      setCreatedKey(null);
      try {
        const created = await createApiKey(
          {
            configId: "organization",
            organizationId: organization.id,
            name: value.name.trim(),
          },
          m.user_api_key_create_error(),
        );

        setCreatedKey(created.key);
        createForm.reset();
        refreshKeys();
      } catch (cause) {
        formApi.setErrorMap({
          onSubmit: {
            form:
              cause instanceof Error
                ? cause.message
                : m.user_api_key_create_error(),
            fields: {},
          },
        });
      }
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

    refreshKeys();
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
      {keysError ? (
        <p className="text-destructive text-sm">{keysError}</p>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Separator />
      <DataTable
        columns={apiKeyColumns({ m })}
        data={keys}
        emptyLabel={loading ? m.user_loading() : m.table_empty()}
        exportFileName={`${organization.slug}-api-keys.csv`}
        features={{ gallery: false }}
        rowActions={apiKeyRowActions({ m, onDelete: deleteKey })}
      />
    </div>
  );
}

const apiKeyColumns = ({
  m,
}: {
  m: ReturnType<typeof organizationMessageFns>;
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
];

const apiKeyRowActions = ({
  m,
  onDelete,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  onDelete: (key: ApiKeySummary) => void;
}) => [
  {
    name: m.user_delete(),
    icon: <Trash2 />,
    variant: "destructive" as const,
    onClick: onDelete,
  },
];
