import type { ApiKey } from "@better-auth/api-key/client";
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { type ColumnDef } from "@tanstack/react-table";
import { Effect, Option, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronsUpDown,
  Copy,
  KeyRound,
  LogOut,
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
  useEffectEvent,
  useRef,
  useState,
} from "react";

import {
  DataTable,
  DataTableRelationshipCell,
} from "@/components/ui/data-table";
import {
  ErrorMessage,
  ImageField,
  SelectField,
  SubmitButton,
  SubmitError,
  TextAreaField,
  TextField,
} from "@/components/ui/effect-form";
import { EditingLocaleSwitcher } from "@/components/ui/editing-locale-switcher";
import { AppBrand } from "@/components/ui/app-brand";
import { Field, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
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
  OrganizationEmail,
  OrganizationAddress,
  OrganizationMetadata,
  OrganizationPhone,
  OrganizationSocial,
  OrganizationTranslation,
  OrganizationWebsite,
  decodeOrganizationMetadata,
  type OrganizationEmail as OrganizationEmailValue,
  type OrganizationAddress as OrganizationAddressValue,
  type OrganizationContactTranslation,
  type OrganizationLocale,
  type OrganizationPhone as OrganizationPhoneValue,
  type OrganizationSocial as OrganizationSocialValue,
  type OrganizationWebsite as OrganizationWebsiteValue,
  type SocialPlatform,
} from "@krak-stack/auth/schema";
import {
  isOrganizationRole,
  normalizeOrganizationRole,
  normalizeOrganizationRoles,
  organizationRoles,
  parseRoleList,
  type OrganizationRole,
} from "../roles";

import type { AuthUiClient } from "./auth-client";
import { authClientApi } from "./auth-client-api";
import { useKrakstackAuth } from "./auth-provider";
import { createApiKey, parseApiKeyReferrers } from "./api-key";
import { ApiKeyEditForm } from "./api-key-edit-form";
import { ApiKeyPermissions } from "./api-key-permissions";
import { ApiKeyRateLimit, apiKeyUsagePercent } from "./api-key-rate-limit";
import { ApiKeyReferrers } from "./api-key-referrers";
import { useOpenedOnce } from "./hooks";
import {
  invitationDisplayStatus,
  isInvitationExpired,
  useInvitationExpirationClock,
} from "./invitation-expiration";
import { ExtraUploadedAsset } from "../extra/schema";
import { assetPath, assetUrl, cn } from "./utils";

type Locale = "en" | "fr";

const messages = {
  en: {
    organization_back: "Back",
    organization_contact: "Contact methods",
    organization_contact_add_email: "Add email",
    organization_contact_add_phone: "Add phone",
    organization_contact_add_social: "Add social profile",
    organization_contact_add_website: "Add website",
    organization_contact_email_type: "Email",
    organization_contact_extension: "Extension",
    organization_contact_label: "Label",
    organization_contact_phone_type: "Phone",
    organization_contact_platform: "Platform",
    organization_contact_remove: "Remove contact method",
    organization_contact_social_type: "Social",
    organization_contact_url: "URL",
    organization_contact_website_type: "Website",
    organization_create_description:
      "Create a workspace for team-based access.",
    organization_create_error: "Could not create the organization.",
    organization_copy_id: "Copy organization ID",
    organization_create_slug_conflict:
      "That organization slug is already in use. Choose a different slug.",
    organization_create_title: "Create organization",
    organization_edit_description:
      "Update the active organization's localized profile.",
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
    organization_invitation_status_accepted: "Accepted",
    organization_invitation_status_canceled: "Canceled",
    organization_invitation_status_expired: "Expired",
    organization_invitation_status_pending: "Pending",
    organization_invitation_status_rejected: "Rejected",
    organization_invitations_description:
      "Track pending and expired invitations.",
    organization_invitations_empty: "No invitations.",
    organization_invitations_heading: "Invitations",
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
    organization_address: "Address",
    organization_address_add: "Add address",
    organization_address_country: "Country",
    organization_address_locality: "City or locality",
    organization_address_postal_code: "Postal code",
    organization_address_region: "State, province, or region",
    organization_address_street: "Street address",
    organization_parent: "Parent organization",
    organization_parent_description:
      "Optionally group this organization under another organization.",
    organization_parent_none: "No parent organization",
    organization_profile: "Profile",
    organization_icon: "Icon",
    organization_logo: "Logo",
    organization_logo_upload_error: "Could not upload the organization logo.",
    organization_member_email: "Email",
    organization_member_joined: "Joined",
    organization_member_leave: "Leave organization",
    organization_member_leave_error: "Could not leave the organization.",
    organization_member_remove: "Remove member",
    organization_member_remove_error: "Could not remove the member.",
    organization_member_role: "Role",
    organization_member_role_error: "Could not update the member role.",
    organization_member_user: "User",
    organization_members_description:
      "Review active members, update roles, and remove access when needed.",
    organization_members_dialog_description:
      "Manage members and invitations for {name}.",
    organization_members_empty: "No members found.",
    organization_members_heading: "Organization members",
    organization_members_load_error: "Could not load organization members.",
    organization_members_title: "Members",
    organization_name_required: "Enter a name in at least one language.",
    organization_role_admin: "Admin",
    organization_role_member: "Member",
    organization_role_owner: "Owner",
    organization_role_support: "Support",
    organization_slug: "Slug",
    organization_slug_description: "Leave blank to generate one from the name.",
    organization_switcher_empty: "You do not belong to any organizations yet.",
    organization_switcher_label: "Organization",
    organization_switcher_manage: "Manage organization",
    organization_switcher_no_other_organizations: "No other organizations.",
    organization_switcher_personal: "Personal",
    organization_translation_description:
      "Localized organization details stored in metadata.",
    organization_translation_name: "Name",
    organization_update_error: "Could not update the organization.",
    table_empty: "No results.",
    user_api_key_back: "Back",
    user_api_key_create_description:
      "Configure a new API key for this organization.",
    user_api_key_create_error: "Could not create the API key.",
    user_api_key_create_title: "Create API key",
    user_api_key_copied: "Copied",
    user_api_key_copy: "Copy",
    user_api_key_created_description:
      "Copy this key now. You will not be able to see it again.",
    user_api_key_created_title: "API key created",
    user_api_key_delete_error: "Could not delete the API key.",
    user_api_key_disabled: "Disabled",
    user_api_key_edit_description:
      "Update the key name, status, allowed referrers, and permissions.",
    user_api_key_edit_title: "Edit API key",
    user_api_key_enabled: "Enabled",
    user_api_key_hidden: "Secret hidden",
    user_api_key_name: "Key name",
    user_api_key_no_permissions: "No permissions",
    user_api_key_permissions: "Permissions",
    user_api_key_permissions_description:
      "Choose the project permissions this API key should receive.",
    user_api_key_rate_limit: "Rate limit",
    user_api_key_referrers: "Allowed referrers (optional)",
    user_api_key_referrers_any: "Any referrer",
    user_api_key_referrers_column: "Referrers",
    user_api_key_referrers_description:
      "Enter any number of URLs, separated by commas or new lines. Leave empty to allow any referrer.",
    user_api_key_referrers_error: "{referrer} is not a valid HTTP(S) URL.",
    user_api_key_referrers_placeholder:
      "https://app.example.com\nhttps://admin.example.com",
    user_api_key_starts_with: "Starts with {start}",
    user_api_key_status: "Status",
    user_api_key_unlimited: "Unlimited",
    user_api_key_update_error: "Could not update the API key.",
    user_api_key_usage: "API key usage",
    user_api_key_window_days: "{count}d",
    user_api_key_window_hours: "{count}h",
    user_api_key_window_minutes: "{count}m",
    user_api_key_window_none: "None",
    user_api_key_window_seconds: "{count}s",
    user_api_keys_load_error: "Could not load API keys.",
    user_api_keys_organization_description:
      "Create and manage API keys for {name}.",
    user_api_keys_title: "API keys",
    user_button_api_keys: "API keys",
    user_delete: "Delete",
    user_loading: "Loading...",
  },
  fr: {
    organization_back: "Retour",
    organization_contact: "Moyens de contact",
    organization_contact_add_email: "Ajouter un courriel",
    organization_contact_add_phone: "Ajouter un téléphone",
    organization_contact_add_social: "Ajouter un profil social",
    organization_contact_add_website: "Ajouter un site Web",
    organization_contact_email_type: "Courriel",
    organization_contact_extension: "Poste",
    organization_contact_label: "Libellé",
    organization_contact_phone_type: "Téléphone",
    organization_contact_platform: "Plateforme",
    organization_contact_remove: "Supprimer le moyen de contact",
    organization_contact_social_type: "Réseau social",
    organization_contact_url: "URL",
    organization_contact_website_type: "Site Web",
    organization_create_description:
      "Créez un espace de travail pour l'accès en équipe.",
    organization_create_error: "Impossible de créer l'organisation.",
    organization_copy_id: "Copier l'ID de l'organisation",
    organization_create_slug_conflict:
      "Ce slug d'organisation est déjà utilisé. Choisissez un autre slug.",
    organization_create_title: "Créer une organisation",
    organization_edit_description:
      "Mettez à jour le profil localisé de l'organisation active.",
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
    organization_invitation_status_accepted: "Acceptée",
    organization_invitation_status_canceled: "Annulée",
    organization_invitation_status_expired: "Expirée",
    organization_invitation_status_pending: "En attente",
    organization_invitation_status_rejected: "Refusée",
    organization_invitations_description:
      "Suivez les invitations en attente et expirées.",
    organization_invitations_empty: "Aucune invitation.",
    organization_invitations_heading: "Invitations",
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
    organization_address: "Adresse",
    organization_address_add: "Ajouter une adresse",
    organization_address_country: "Pays",
    organization_address_locality: "Ville ou localité",
    organization_address_postal_code: "Code postal",
    organization_address_region: "État, province ou région",
    organization_address_street: "Adresse municipale",
    organization_parent: "Organisation parente",
    organization_parent_description:
      "Regroupez facultativement cette organisation sous une autre organisation.",
    organization_parent_none: "Aucune organisation parente",
    organization_profile: "Profil",
    organization_icon: "Icône",
    organization_logo: "Logo",
    organization_logo_upload_error:
      "Impossible de téléverser le logo de l'organisation.",
    organization_member_email: "Courriel",
    organization_member_joined: "Arrivée",
    organization_member_leave: "Quitter l'organisation",
    organization_member_leave_error: "Impossible de quitter l'organisation.",
    organization_member_remove: "Retirer le membre",
    organization_member_remove_error: "Impossible de retirer le membre.",
    organization_member_role: "Rôle",
    organization_member_role_error: "Impossible de modifier le rôle du membre.",
    organization_member_user: "Utilisateur",
    organization_members_description:
      "Consultez les membres actifs, modifiez les rôles et retirez les accès au besoin.",
    organization_members_dialog_description:
      "Gérez les membres et les invitations de {name}.",
    organization_members_empty: "Aucun membre trouvé.",
    organization_members_heading: "Membres de l'organisation",
    organization_members_load_error:
      "Impossible de charger les membres de l'organisation.",
    organization_members_title: "Membres",
    organization_name_required: "Saisissez un nom dans au moins une langue.",
    organization_role_admin: "Admin",
    organization_role_member: "Membre",
    organization_role_owner: "Propriétaire",
    organization_role_support: "Support",
    organization_slug: "Slug",
    organization_slug_description:
      "Laissez vide pour en générer un à partir du nom.",
    organization_switcher_empty:
      "Vous n'appartenez encore à aucune organisation.",
    organization_switcher_label: "Organisation",
    organization_switcher_manage: "Gérer l'organisation",
    organization_switcher_no_other_organizations: "Aucune autre organisation.",
    organization_switcher_personal: "Personnel",
    organization_translation_description:
      "Détails localisés de l'organisation stockés dans les métadonnées.",
    organization_translation_name: "Nom",
    organization_update_error: "Impossible de mettre à jour l'organisation.",
    table_empty: "Aucun résultat.",
    user_api_key_back: "Retour",
    user_api_key_create_description:
      "Configurez une nouvelle clé API pour cette organisation.",
    user_api_key_create_error: "Impossible de créer la clé API.",
    user_api_key_create_title: "Créer une clé API",
    user_api_key_copied: "Copié",
    user_api_key_copy: "Copier",
    user_api_key_created_description:
      "Copiez cette clé maintenant. Vous ne pourrez plus la voir.",
    user_api_key_created_title: "Clé API créée",
    user_api_key_delete_error: "Impossible de supprimer la clé API.",
    user_api_key_disabled: "Désactivée",
    user_api_key_edit_description:
      "Mettez à jour le nom, le statut, les référents autorisés et les autorisations de la clé.",
    user_api_key_edit_title: "Modifier la clé API",
    user_api_key_enabled: "Activée",
    user_api_key_hidden: "Secret masqué",
    user_api_key_name: "Nom de la clé",
    user_api_key_no_permissions: "Aucune autorisation",
    user_api_key_permissions: "Autorisations",
    user_api_key_permissions_description:
      "Choisissez les autorisations de projet à attribuer à cette clé API.",
    user_api_key_rate_limit: "Limite de débit",
    user_api_key_referrers: "Référents autorisés (facultatifs)",
    user_api_key_referrers_any: "Tout référent",
    user_api_key_referrers_column: "Référents",
    user_api_key_referrers_description:
      "Saisissez autant d'URL que nécessaire, séparées par des virgules ou des sauts de ligne. Laissez vide pour autoriser tout référent.",
    user_api_key_referrers_error:
      "{referrer} n'est pas une URL HTTP(S) valide.",
    user_api_key_referrers_placeholder:
      "https://app.example.com\nhttps://admin.example.com",
    user_api_key_starts_with: "Commence par {start}",
    user_api_key_status: "Statut",
    user_api_key_unlimited: "Illimitée",
    user_api_key_update_error: "Impossible de mettre à jour la clé API.",
    user_api_key_usage: "Utilisation de la clé API",
    user_api_key_window_days: "{count} j",
    user_api_key_window_hours: "{count} h",
    user_api_key_window_minutes: "{count} min",
    user_api_key_window_none: "Aucune",
    user_api_key_window_seconds: "{count} s",
    user_api_keys_load_error: "Impossible de charger les clés API.",
    user_api_keys_organization_description:
      "Créez et gérez les clés API de {name}.",
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

export type OrganizationSwitcherFeatures = {
  organizationSwitching?: boolean;
  organizationCreation?: boolean;
  userInvitations?: boolean;
};

export type OrganizationSwitcherProps = {
  authClient?: AuthUiClient;
  baseUrl?: string | undefined;
  side?: ComponentProps<typeof DropdownMenuContent>["side"];
  className?: string;
  defaultDialog?: OrganizationSwitcherDialog | null;
  features?: OrganizationSwitcherFeatures;
  hideTrigger?: boolean;
  menuActions?: ReactNode;
  renderUnauthenticated?: () => ReactNode;
  allowedOrganizationIds?: readonly string[];
  messages?: OrganizationSwitcherMessages;
  dialog?: OrganizationSwitcherDialog | null;
  onChange?: (organization: OrganizationSummary | null) => void;
  onCreate?: (organization: OrganizationSummary) => void;
  onDialogChange?: (dialog: OrganizationSwitcherDialog | null) => void;
  apiKeyPermissions?: Readonly<Record<string, ReadonlyArray<string>>>;
};

type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  metadata?: unknown;
  userId?: string | null;
  parentId?: string | null;
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
type OrganizationMembersData = {
  members: OrganizationMemberSummary[];
  invitations: OrganizationInvitationSummary[];
};
type OrganizationMemberRow = Omit<OrganizationMemberSummary, "role"> & {
  role: string;
};

const normalizeInvitationRole = (role: string) => {
  const normalized = normalizeOrganizationRole(role);
  return normalized === "support" ? "member" : normalized;
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

          return (result.data ?? []).filter(
            (invitation) => invitation.status === "pending",
          );
        },
        catch: (error) => error,
      }),
    ),
  ),
);

const invitationOrganizationProfileAtom = Atom.family(
  ({
    baseUrl,
    locale,
    organizationId,
  }: {
    baseUrl?: string | undefined;
    locale: OrganizationLocale;
    organizationId: string;
  }) =>
    authClientApi(baseUrl).query("authExtra", "getOrganizationPublicProfile", {
      query: { locale, organizationId },
      timeToLive: "5 minutes",
      serializationKey: `invitation-organization:${organizationId}:${locale}`,
    }),
);

const emptyUserInvitationsAtom = Atom.make(
  Effect.try({
    try: (): UserInvitationSummary[] => [],
    catch: (error) => error,
  }),
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
              invitations: (invitationsResult.data ?? []).filter(
                (invitation) => invitation.status === "pending",
              ),
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
          try: async (): Promise<ApiKeySummary[]> => {
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
  parentId: string;
  slug: string;
  emails: ReadonlyArray<OrganizationEmailValue>;
  phones: ReadonlyArray<OrganizationPhoneValue>;
  websites: ReadonlyArray<OrganizationWebsiteValue>;
  socials: ReadonlyArray<OrganizationSocialValue>;
  addresses: ReadonlyArray<OrganizationAddressValue>;
  enName: string;
  enLogo: File | string | null | undefined;
  enIcon: File | string | null | undefined;
  frName: string;
  frLogo: File | string | null | undefined;
  frIcon: File | string | null | undefined;
};

const organizationImageSchema = Schema.Union([
  Schema.String,
  Schema.instanceOf(File),
  Schema.Null,
  Schema.Undefined,
]);

const organizationFormBuilder = FormBuilder.empty
  .addField("parentId", Schema.String)
  .addField("slug", Schema.String)
  .addField("emails", Schema.Array(OrganizationEmail))
  .addField("phones", Schema.Array(OrganizationPhone))
  .addField("websites", Schema.Array(OrganizationWebsite))
  .addField("socials", Schema.Array(OrganizationSocial))
  .addField("addresses", Schema.Array(OrganizationAddress))
  .addField("enName", Schema.String)
  .addField("enLogo", organizationImageSchema)
  .addField("enIcon", organizationImageSchema)
  .addField("frName", Schema.String)
  .addField("frLogo", organizationImageSchema)
  .addField("frIcon", organizationImageSchema);

const socialPlatform = (value: string | null): SocialPlatform | null => {
  switch (value) {
    case "facebook":
    case "github":
    case "instagram":
    case "linkedin":
    case "tiktok":
    case "x":
    case "youtube":
      return value;
    default:
      return null;
  }
};

const contactLabel = (
  translations: ReadonlyArray<OrganizationContactTranslation> | undefined,
  locale: OrganizationLocale,
) =>
  translations?.find((translation) => translation.locale === locale)?.label ??
  "";

const contactTranslations = (
  translations: ReadonlyArray<OrganizationContactTranslation> | undefined,
  locale: OrganizationLocale,
  label: string,
): OrganizationContactTranslation[] => [
  ...(translations ?? []).filter(
    (translation) => translation.locale !== locale,
  ),
  ...(label ? [{ locale, label }] : []),
];

const EmailsField: FormReact.FieldComponent<
  ReadonlyArray<OrganizationEmailValue>,
  { locale: OrganizationLocale }
> = ({ field, props }) => {
  const m = useOrganizationMessages();

  return (
    <RepeatableContactField
      addLabel={m.organization_contact_add_email()}
      emptyValue={{
        email: "",
        translations: [{ locale: props.locale, label: "" }],
      }}
      error={Option.isSome(field.error) ? field.error.value : undefined}
      path={field.path}
      values={field.value}
      onChange={field.onChange}
      render={(contact, index, update) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <ContactInput
            id={`${field.path}-${index}-email`}
            label={m.organization_contact_email_type()}
            placeholder="team@example.com"
            type="email"
            value={contact.email}
            onBlur={field.onBlur}
            onChange={(email) => update({ ...contact, email })}
          />
          <ContactLabelInput
            id={`${field.path}-${index}-label`}
            locale={props.locale}
            translations={contact.translations}
            onBlur={field.onBlur}
            onChange={(translations) =>
              update({
                ...contact,
                translations,
              })
            }
          />
        </div>
      )}
    />
  );
};

const PhonesField: FormReact.FieldComponent<
  ReadonlyArray<OrganizationPhoneValue>,
  { locale: OrganizationLocale }
> = ({ field, props }) => {
  const m = useOrganizationMessages();
  return (
    <RepeatableContactField
      addLabel={m.organization_contact_add_phone()}
      emptyValue={{
        number: "",
        translations: [{ locale: props.locale, label: "" }],
      }}
      error={Option.isSome(field.error) ? field.error.value : undefined}
      path={field.path}
      values={field.value}
      onChange={field.onChange}
      render={(phone, index, update) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <ContactInput
            id={`${field.path}-${index}-number`}
            label={m.organization_contact_phone_type()}
            placeholder="+1 514 555 0100"
            type="tel"
            value={phone.number}
            onBlur={field.onBlur}
            onChange={(number) => update({ ...phone, number })}
          />
          <ContactInput
            id={`${field.path}-${index}-extension`}
            label={m.organization_contact_extension()}
            value={phone.extension ?? ""}
            onBlur={field.onBlur}
            onChange={(extension) =>
              update({
                ...phone,
                ...(extension ? { extension } : { extension: undefined }),
              })
            }
          />
          <ContactLabelInput
            id={`${field.path}-${index}-label`}
            locale={props.locale}
            translations={phone.translations}
            onBlur={field.onBlur}
            onChange={(translations) =>
              update({
                ...phone,
                translations,
              })
            }
          />
        </div>
      )}
    />
  );
};

function ContactInput({
  className,
  id,
  label,
  onBlur,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  className?: string;
  id: string;
  label: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "email" | "tel" | "text" | "url";
  value: string;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        className="mt-2"
        value={value}
        type={type}
        placeholder={placeholder}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ContactLabelInput({
  id,
  locale,
  onBlur,
  onChange,
  translations,
}: {
  id: string;
  locale: OrganizationLocale;
  onBlur: () => void;
  onChange: (translations: OrganizationContactTranslation[]) => void;
  translations: ReadonlyArray<OrganizationContactTranslation> | undefined;
}) {
  const m = useOrganizationMessages();

  return (
    <ContactInput
      id={id}
      label={m.organization_contact_label()}
      value={contactLabel(translations, locale)}
      onBlur={onBlur}
      onChange={(label) =>
        onChange(contactTranslations(translations, locale, label))
      }
    />
  );
}

const WebsitesField: FormReact.FieldComponent<
  ReadonlyArray<OrganizationWebsiteValue>,
  { locale: OrganizationLocale }
> = ({ field, props }) => {
  const m = useOrganizationMessages();
  return (
    <RepeatableContactField
      addLabel={m.organization_contact_add_website()}
      emptyValue={{
        url: "",
        translations: [{ locale: props.locale, label: "" }],
      }}
      error={Option.isSome(field.error) ? field.error.value : undefined}
      path={field.path}
      values={field.value}
      onChange={field.onChange}
      render={(website, index, update) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <ContactInput
            id={`${field.path}-${index}-url`}
            label={m.organization_contact_url()}
            placeholder="https://example.com"
            type="url"
            value={website.url}
            onBlur={field.onBlur}
            onChange={(url) => update({ ...website, url })}
          />
          <ContactLabelInput
            id={`${field.path}-${index}-label`}
            locale={props.locale}
            translations={website.translations}
            onBlur={field.onBlur}
            onChange={(translations) =>
              update({
                ...website,
                translations,
              })
            }
          />
        </div>
      )}
    />
  );
};

function RepeatableContactField<T>({
  addLabel,
  emptyValue,
  error,
  onChange,
  path,
  render,
  values,
}: {
  addLabel: string;
  emptyValue: T;
  error: string | undefined;
  onChange: (values: ReadonlyArray<T>) => void;
  path: string;
  render: (value: T, index: number, onChange: (value: T) => void) => ReactNode;
  values: ReadonlyArray<T>;
}) {
  const m = useOrganizationMessages();

  return (
    <Field>
      <div className="flex flex-col gap-3">
        {values.map((value, index) => (
          <div
            className="bg-muted/20 relative rounded-lg border p-4 pr-12"
            key={`${path}-${index}`}
          >
            {render(value, index, (next) =>
              onChange(
                values.map((item, itemIndex) =>
                  itemIndex === index ? next : item,
                ),
              ),
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              aria-label={m.organization_contact_remove()}
              onClick={() =>
                onChange(values.filter((_, itemIndex) => itemIndex !== index))
              }
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onChange([...values, emptyValue])}
        >
          <Plus />
          {addLabel}
        </Button>
        {error ? <ErrorMessage text={error} /> : null}
      </div>
    </Field>
  );
}

function SocialPlatformSelect({
  value,
  onChange,
}: {
  value: SocialPlatform;
  onChange: (value: SocialPlatform) => void;
}) {
  const m = useOrganizationMessages();
  const items = [
    { label: "Facebook", value: "facebook" },
    { label: "GitHub", value: "github" },
    { label: "Instagram", value: "instagram" },
    { label: "LinkedIn", value: "linkedin" },
    { label: "TikTok", value: "tiktok" },
    { label: "X", value: "x" },
    { label: "YouTube", value: "youtube" },
  ];

  return (
    <div>
      <FieldLabel>{m.organization_contact_platform()}</FieldLabel>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => {
          const platform = socialPlatform(next);
          if (platform) onChange(platform);
        }}
      >
        <SelectTrigger className="mt-2 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const SocialsField: FormReact.FieldComponent<
  ReadonlyArray<OrganizationSocialValue>,
  { locale: OrganizationLocale }
> = ({ field, props }) => {
  const m = useOrganizationMessages();

  return (
    <RepeatableContactField
      addLabel={m.organization_contact_add_social()}
      emptyValue={{
        platform: "linkedin",
        url: "",
        translations: [{ locale: props.locale, label: "" }],
      }}
      error={Option.isSome(field.error) ? field.error.value : undefined}
      path={field.path}
      values={field.value}
      onChange={field.onChange}
      render={(social, index, update) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <SocialPlatformSelect
            value={social.platform}
            onChange={(platform) => update({ ...social, platform })}
          />
          <ContactInput
            id={`${field.path}-${index}-url`}
            label={m.organization_contact_url()}
            placeholder="https://example.com/profile"
            type="url"
            value={social.url}
            onBlur={field.onBlur}
            onChange={(url) => update({ ...social, url })}
          />
          <ContactLabelInput
            id={`${field.path}-${index}-label`}
            locale={props.locale}
            translations={social.translations}
            onBlur={field.onBlur}
            onChange={(translations) =>
              update({
                ...social,
                translations,
              })
            }
          />
        </div>
      )}
    />
  );
};

const AddressesField: FormReact.FieldComponent<
  ReadonlyArray<OrganizationAddressValue>,
  { locale: OrganizationLocale }
> = ({ field, props }) => {
  const m = useOrganizationMessages();
  const inputs: ReadonlyArray<{
    key: "streetAddress" | "locality" | "region" | "postalCode" | "country";
    label: string;
    className?: string;
  }> = [
    {
      key: "streetAddress",
      label: m.organization_address_street(),
      className: "sm:col-span-2",
    },
    { key: "locality", label: m.organization_address_locality() },
    { key: "region", label: m.organization_address_region() },
    { key: "postalCode", label: m.organization_address_postal_code() },
    { key: "country", label: m.organization_address_country() },
  ];

  return (
    <RepeatableContactField
      addLabel={m.organization_address_add()}
      emptyValue={{
        translations: [{ locale: props.locale, label: "" }],
      }}
      error={Option.isSome(field.error) ? field.error.value : undefined}
      path={field.path}
      values={field.value}
      onChange={field.onChange}
      render={(address, index, update) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <ContactLabelInput
            id={`${field.path}-${index}-label`}
            locale={props.locale}
            translations={address.translations}
            onBlur={field.onBlur}
            onChange={(translations) =>
              update({
                ...address,
                translations,
              })
            }
          />
          {inputs.map((input) => (
            <ContactInput
              {...(input.className ? { className: input.className } : {})}
              id={`${field.path}-${index}-${input.key}`}
              key={input.key}
              label={input.label}
              value={address[input.key] ?? ""}
              onBlur={field.onBlur}
              onChange={(value) => update({ ...address, [input.key]: value })}
            />
          ))}
        </div>
      )}
    />
  );
};

const organizationFormFields = {
  parentId: SelectField,
  slug: TextField,
  emails: EmailsField,
  phones: PhonesField,
  websites: WebsitesField,
  socials: SocialsField,
  addresses: AddressesField,
  enName: TextField,
  enLogo: ImageField,
  enIcon: ImageField,
  frName: TextField,
  frLogo: ImageField,
  frIcon: ImageField,
};

const inviteMemberFormBuilder = FormBuilder.empty
  .addField("email", Schema.NonEmptyString)
  .addField("role", Schema.String);

const apiKeyFormBuilder = FormBuilder.empty
  .addField("name", Schema.NonEmptyString)
  .addField("referrers", Schema.String);

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const noParentOrganization = "__none__";

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

const parseOrganizationMetadata = decodeOrganizationMetadata;

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

const organizationSwitcherSubtitle = (
  organization: OrganizationSummary | null,
  subtitle: string,
  m: ReturnType<typeof organizationMessageFns>,
) =>
  organization?.userId
    ? `${m.organization_switcher_personal()} · ${subtitle}`
    : subtitle;

const organizationParentOptions = (
  organizations: readonly OrganizationSummary[],
  m: ReturnType<typeof organizationMessageFns>,
  excludedOrganizationId?: string,
) => [
  {
    label: m.organization_parent_none(),
    value: noParentOrganization,
  },
  ...organizations
    .filter(
      (organization) =>
        organization.id !== excludedOrganizationId &&
        !organization.userId &&
        !organization.parentId,
    )
    .map((organization) => ({
      label: organizationDisplay(organization, m).name,
      value: organization.id,
    })),
];

const organizationFormDefaults = (
  organization?: OrganizationSummary,
  baseUrl?: string,
): OrganizationFormValues => {
  const metadata = parseOrganizationMetadata(organization?.metadata);
  const translations = metadata.translations;
  const en = translations.find((translation) => translation.locale === "en");
  const fr = translations.find((translation) => translation.locale === "fr");
  const emails = Array.from(metadata.emails ?? []);
  for (const translation of translations) {
    if (
      translation.contactEmail &&
      !emails.some((email) => email.email === translation.contactEmail)
    ) {
      emails.push({
        email: translation.contactEmail,
        translations: [
          {
            locale: translation.locale,
            label: translation.locale === "fr" ? "Courriel" : "Email",
          },
        ],
      });
    }
  }
  return {
    parentId: organization?.parentId ?? noParentOrganization,
    slug: organization?.slug ?? "",
    emails,
    phones: Array.from(metadata.phones ?? []),
    websites: Array.from(metadata.websites ?? []),
    socials: Array.from(metadata.socials ?? []),
    addresses: Array.from(metadata.addresses ?? []),
    enName: en?.name || organization?.name || "",
    enLogo: assetUrl(en?.logo, baseUrl) || null,
    enIcon: assetUrl(en?.icon, baseUrl) || null,
    frName: fr?.name ?? "",
    frLogo: assetUrl(fr?.logo, baseUrl) || null,
    frIcon: assetUrl(fr?.icon, baseUrl) || null,
  };
};

const organizationLogoFromForm = async (
  value: File | string | null | undefined,
  m: ReturnType<typeof organizationMessageFns>,
  uploadImage: (input: { payload: FormData }) => Promise<unknown>,
) => {
  if (value instanceof File)
    return await uploadImageAsset(value, m, uploadImage);
  if (typeof value === "string") return assetPath(value);
  return null;
};

const organizationNameFromForm = (
  value: OrganizationFormValues,
  locale: OrganizationLocale,
) => {
  const preferredName = locale === "fr" ? value.frName : value.enName;
  const fallbackName = locale === "fr" ? value.enName : value.frName;

  return preferredName.trim() || fallbackName.trim();
};

const organizationRoleLabel = (
  role: string,
  m: ReturnType<typeof organizationMessageFns>,
) => {
  switch (normalizeOrganizationRole(role)) {
    case "owner":
      return m.organization_role_owner();
    case "admin":
      return m.organization_role_admin();
    case "support":
      return m.organization_role_support();
    case "member":
      return m.organization_role_member();
  }
};

const invitationStatusLabel = (
  status: string,
  m: ReturnType<typeof organizationMessageFns>,
) => {
  switch (status) {
    case "accepted":
      return m.organization_invitation_status_accepted();
    case "canceled":
      return m.organization_invitation_status_canceled();
    case "expired":
      return m.organization_invitation_status_expired();
    case "pending":
      return m.organization_invitation_status_pending();
    case "rejected":
      return m.organization_invitation_status_rejected();
    default:
      return status;
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
  existingMetadata?: unknown,
): Promise<OrganizationMetadata> => {
  const existing = parseOrganizationMetadata(existingMetadata);
  const decodedExistingMetadata =
    typeof existingMetadata === "string"
      ? Option.getOrNull(
          Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))(
            existingMetadata,
          ),
        )
      : existingMetadata;
  const preservedMetadata =
    typeof decodedExistingMetadata === "object" &&
    decodedExistingMetadata !== null &&
    !Array.isArray(decodedExistingMetadata)
      ? decodedExistingMetadata
      : {};
  const translations: OrganizationTranslation[] = [];
  const enName = value.enName.trim();
  const frName = value.frName.trim();
  const enLogo = await organizationLogoFromForm(value.enLogo, m, uploadImage);
  const enIcon = await organizationLogoFromForm(value.enIcon, m, uploadImage);
  const frLogo = await organizationLogoFromForm(value.frLogo, m, uploadImage);
  const frIcon = await organizationLogoFromForm(value.frIcon, m, uploadImage);
  const localized = (
    values: ReadonlyArray<OrganizationContactTranslation> | undefined,
  ): OrganizationContactTranslation[] =>
    (values ?? []).flatMap((translation) => {
      const label = translation.label.trim();
      return label ? [{ ...translation, label }] : [];
    });
  const emails = value.emails.flatMap((email) => {
    const address = email.email.trim();
    return address
      ? [
          {
            email: address,
            translations: localized(email.translations),
          },
        ]
      : [];
  });
  const phones = value.phones.flatMap((phone) => {
    const number = phone.number.trim();
    return number
      ? [
          {
            number,
            ...(phone.extension?.trim()
              ? { extension: phone.extension.trim() }
              : {}),
            translations: localized(phone.translations),
          },
        ]
      : [];
  });
  const websites = value.websites.flatMap((website) => {
    const url = website.url.trim();
    return url ? [{ url, translations: localized(website.translations) }] : [];
  });
  const socials = value.socials.flatMap((social) => {
    const url = social.url.trim();
    return url
      ? [
          {
            platform: social.platform,
            url,
            translations: localized(social.translations),
          },
        ]
      : [];
  });
  const addresses = value.addresses.flatMap((input) => {
    const normalized = {
      ...(input.streetAddress?.trim()
        ? { streetAddress: input.streetAddress.trim() }
        : {}),
      ...(input.locality?.trim() ? { locality: input.locality.trim() } : {}),
      ...(input.region?.trim() ? { region: input.region.trim() } : {}),
      ...(input.postalCode?.trim()
        ? { postalCode: input.postalCode.trim() }
        : {}),
      ...(input.country?.trim() ? { country: input.country.trim() } : {}),
    };
    return Object.keys(normalized).length
      ? [
          {
            ...normalized,
            translations: localized(input.translations),
          },
        ]
      : [];
  });
  const localizedEmail = (locale: OrganizationLocale) =>
    emails.find((email) =>
      email.translations.some((translation) => translation.locale === locale),
    )?.email ??
    emails[0]?.email ??
    null;
  const localizedLocation = (locale: OrganizationLocale) => {
    const address =
      addresses.find((item) =>
        item.translations.some((translation) => translation.locale === locale),
      ) ?? addresses[0];
    if (!address) {
      return existing.translations.find(
        (translation) => translation.locale === locale,
      )?.location;
    }

    return [
      address.streetAddress,
      [address.locality, address.region, address.postalCode]
        .filter(Boolean)
        .join(" "),
      address.country,
    ]
      .filter(Boolean)
      .join(", ");
  };

  if (enName) {
    translations.push({
      locale: "en",
      name: enName,
      logo: enLogo,
      icon: enIcon,
      contactEmail: localizedEmail("en"),
      location: localizedLocation("en") ?? null,
    });
  }

  if (frName) {
    translations.push({
      locale: "fr",
      name: frName,
      logo: frLogo,
      icon: frIcon,
      contactEmail: localizedEmail("fr"),
      location: localizedLocation("fr") ?? null,
    });
  }

  return {
    ...preservedMetadata,
    translations,
    emails,
    phones,
    websites,
    socials,
    addresses,
  };
};

export function OrganizationSwitcher({
  authClient: providedAuthClient,
  baseUrl,
  side = "bottom",
  className,
  defaultDialog = null,
  features,
  hideTrigger = false,
  menuActions,
  renderUnauthenticated,
  allowedOrganizationIds,
  messages,
  dialog: controlledDialog,
  onChange,
  onCreate,
  onDialogChange,
  apiKeyPermissions,
}: OrganizationSwitcherProps) {
  const auth = useKrakstackAuth();
  const authClient = providedAuthClient ?? auth?.authClient;

  if (!authClient) {
    throw new Error("KrakstackAuthProvider is required to use authClient.");
  }

  const labels = organizationSwitcherMessages(messages);
  const m = organizationMessageFns(labels);
  const session = authClient.useSession();
  const organizations = authClient.useListOrganizations();
  const activeOrganization = authClient.useActiveOrganization();
  const lastAuthRefreshVersion = useRef(auth?.authRefreshVersion ?? 0);
  const [uncontrolledDialog, setUncontrolledDialog] =
    useState<OrganizationSwitcherDialog | null>(defaultDialog);
  const [editingOrganizationLocale, setEditingOrganizationLocale] =
    useState<OrganizationLocale>(currentOrganizationLocale);
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
  const activeMemberRoles = parseRoleList(
    activeOrganization.data?.members.find(
      (member) => member.userId === session.data?.user.id,
    )?.role,
  );
  const canManageApiKeys = activeMemberRoles.some(
    (role) => role === "owner" || role === "admin",
  );
  const canUpdateOrganization = canManageApiKeys;
  const canSwitchOrganizations = features?.organizationSwitching ?? true;
  const canCreateOrganization = features?.organizationCreation ?? true;
  const canViewOrganizationInvitations = features?.userInvitations ?? true;

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

  const refresh = async () => {
    await organizations.refetch();
    await activeOrganization.refetch();
    await session.refetch();
  };
  const refreshOnSessionChanged = useEffectEvent(() => {
    void refresh();
  });

  useEffect(() => {
    const version = auth?.authRefreshVersion ?? 0;
    if (version === lastAuthRefreshVersion.current) return;

    lastAuthRefreshVersion.current = version;
    refreshOnSessionChanged();
  }, [auth?.authRefreshVersion]);

  if (!session.data) {
    return <>{renderUnauthenticated?.()}</>;
  }

  const active = activeOrganization.data;
  const activeName = active?.name;
  const visibleOrganizations =
    organizations.data?.filter(
      (organization) =>
        !allowedOrganizationIds ||
        allowedOrganizationIds.includes(organization.id),
    ) ?? [];
  const selectableOrganizations = canSwitchOrganizations
    ? visibleOrganizations.filter(
        (organization) => organization.id !== active?.id,
      )
    : [];
  const hasOrganizationListItems =
    organizations.isPending ||
    Boolean(organizations.error) ||
    canSwitchOrganizations;

  const refreshAfterInvitationAction = async (previousActiveId?: string) => {
    refreshUserInvitations();
    await refresh();

    if (!canSwitchOrganizations && previousActiveId) {
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
  const activeSubtitle = organizationSwitcherSubtitle(
    active ?? null,
    activeDisplay.subtitle,
    m,
  );

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
                  subtitle={activeSubtitle}
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
                  subtitle={activeSubtitle}
                  icon={Building2}
                  variant="sidebar"
                  className="px-1 py-1.5 text-left text-sm"
                  {...(activeDisplay.image
                    ? { imageSrc: activeDisplay.image }
                    : {})}
                />
              </DropdownMenuLabel>
              {menuActions ? (
                <>
                  <DropdownMenuSeparator />
                  {menuActions}
                </>
              ) : null}
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
              {canSwitchOrganizations && selectableOrganizations.length ? (
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
                        subtitle={organizationSwitcherSubtitle(
                          organization,
                          display.subtitle,
                          m,
                        )}
                        icon={Building2}
                        className="w-full text-left [&>div:first-child]:size-7"
                        {...(display.image ? { imageSrc: display.image } : {})}
                      />
                    </DropdownMenuItem>
                  );
                })
              ) : canSwitchOrganizations && !organizations.isPending ? (
                <DropdownMenuItem disabled>
                  {active
                    ? m.organization_switcher_no_other_organizations()
                    : m.organization_switcher_empty()}
                </DropdownMenuItem>
              ) : null}
              {canCreateOrganization || canViewOrganizationInvitations ? (
                <>
                  <DropdownMenuSeparator />
                  {canCreateOrganization ? (
                    <DropdownMenuItem onClick={openCreate}>
                      <Plus />
                      {m.organization_create_title()}
                    </DropdownMenuItem>
                  ) : null}
                  {canViewOrganizationInvitations ? (
                    <DropdownMenuItem
                      onClick={() => {
                        setDialog("invitations");
                      }}
                    >
                      <Mail />
                      <span className="flex flex-1 items-center justify-between gap-3">
                        {m.organization_user_invitations_title()}
                        {userInvitations.length ? (
                          <Badge
                            variant="secondary"
                            className="bg-secondary! text-secondary-foreground!"
                          >
                            {userInvitations.length}
                          </Badge>
                        ) : null}
                      </span>
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : null}
              {activeOrganization.data ? (
                <>
                  <DropdownMenuSeparator />
                  {(() => {
                    const organizationId = activeOrganization.data.id;

                    return (
                      <DropdownMenuItem
                        onClick={() => {
                          void navigator.clipboard.writeText(organizationId);
                        }}
                      >
                        <Copy />
                        {m.organization_copy_id()}
                      </DropdownMenuItem>
                    );
                  })()}
                  {canUpdateOrganization ? (
                    <DropdownMenuItem onClick={() => setDialog("manage")}>
                      <PencilIcon />
                      {m.organization_switcher_manage()}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={() => setDialog("members")}>
                    <Users />
                    {m.organization_members_title()}
                  </DropdownMenuItem>
                  {canManageApiKeys ? (
                    <DropdownMenuItem onClick={() => setDialog("apiKeys")}>
                      <KeyRound />
                      {m.user_button_api_keys()}
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : null}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Dialog
        open={dialog === "create" && canCreateOrganization}
        onOpenChange={(open) => {
          setDialog((current) =>
            open ? "create" : current === "create" ? null : current,
          );
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {m.organization_create_title()}
            </DialogTitle>
            <DialogDescription>
              {m.organization_create_description()}
            </DialogDescription>
            <div className="pt-2">
              <EditingLocaleSwitcher
                value={editingOrganizationLocale}
                onValueChange={setEditingOrganizationLocale}
              />
            </div>
          </DialogHeader>
          <Separator />
          <CreateOrganizationSection
            authClient={authClient}
            baseUrl={baseUrl}
            editingLocale={editingOrganizationLocale}
            organizations={visibleOrganizations}
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
        open={dialog === "manage" && canUpdateOrganization}
        onOpenChange={(open) => {
          setDialog((current) =>
            open ? "manage" : current === "manage" ? null : current,
          );
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {m.organization_switcher_manage()}
            </DialogTitle>
            <DialogDescription>
              {m.organization_edit_description()}
            </DialogDescription>
            <div className="pt-2">
              <EditingLocaleSwitcher
                value={editingOrganizationLocale}
                onValueChange={setEditingOrganizationLocale}
              />
            </div>
          </DialogHeader>
          <Separator />
          {activeOrganization.data && canUpdateOrganization ? (
            <EditOrganizationSection
              authClient={authClient}
              baseUrl={baseUrl}
              editingLocale={editingOrganizationLocale}
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
          {activeOrganization.data ? (
            <OrganizationMembersManager
              authClient={authClient}
              baseUrl={baseUrl}
              canManageMembers={canManageApiKeys}
              organization={activeOrganization.data}
              currentUserId={session.data.user.id}
              active={dialog === "members"}
              onLeft={async () => {
                setDialog(null);
                auth?.refreshAuth();
                await refresh();
                onChange?.(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === "apiKeys" && canManageApiKeys}
        onOpenChange={(open) => {
          setDialog((current) =>
            open ? "apiKeys" : current === "apiKeys" ? null : current,
          );
        }}
      >
        <DialogContent className="max-h-[85vh] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-3xl">
          {activeOrganization.data ? (
            <OrganizationApiKeyManager
              authClient={authClient}
              organization={activeOrganization.data}
              active={dialog === "apiKeys" && canManageApiKeys}
              permissions={
                apiKeyPermissions ??
                auth?.access?.organizationApiKeyPermissions ??
                {}
              }
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === "invitations" && canViewOrganizationInvitations}
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
            baseUrl={baseUrl}
            invitations={userInvitations}
            loading={loadingUserInvitations}
            error={userInvitationsError}
            {...(activeOrganization.data
              ? { activeOrganizationId: activeOrganization.data.id }
              : {})}
            onActionComplete={refreshAfterInvitationAction}
          />
        </DialogContent>
      </Dialog>
    </OrganizationMessagesContext.Provider>
  );
}

function UserInvitationsManager({
  authClient,
  baseUrl,
  invitations,
  loading,
  error,
  activeOrganizationId,
  onActionComplete,
}: {
  authClient: AuthUiClient;
  baseUrl?: string | undefined;
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
  const invitationNow = useInvitationExpirationClock(invitations);

  const acceptInvitation = async (invitation: UserInvitationSummary) => {
    if (isInvitationExpired(invitation)) return;

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
          baseUrl,
          m,
          now: invitationNow,
        })}
        data={invitations}
        features={{
          export: { baseName: "organization-invitations" },
          gallery: false,
          rowActions: {
            items: userInvitationRowActions({
              m,
              actingInvitationId,
              now: invitationNow,
              onAccept: acceptInvitation,
              onReject: rejectInvitation,
            }),
          },
        }}
        searchState="local"
        state={{
          empty: loading
            ? m.user_loading()
            : m.organization_user_invitations_empty(),
          loading,
        }}
      />
    </section>
  );
}

const userInvitationColumns = ({
  baseUrl,
  m,
  now,
}: {
  baseUrl?: string | undefined;
  m: ReturnType<typeof organizationMessageFns>;
  now: number;
}): ColumnDef<UserInvitationSummary>[] => [
  {
    accessorKey: "organizationName",
    header: m.organization_invitation_organization(),
    cell: ({ row }) => (
      <InvitationOrganizationBrand
        baseUrl={baseUrl}
        invitation={row.original}
      />
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
    cell: ({ row }) => (
      <Badge
        variant={
          isInvitationExpired(row.original, now) ? "destructive" : "default"
        }
      >
        {invitationStatusLabel(invitationDisplayStatus(row.original, now), m)}
      </Badge>
    ),
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

function InvitationOrganizationBrand({
  baseUrl,
  invitation,
}: {
  baseUrl?: string | undefined;
  invitation: UserInvitationSummary;
}) {
  const locale = useKrakstackAuth()?.locale ?? currentOrganizationLocale();
  const profileResult = useAtomValue(
    invitationOrganizationProfileAtom({
      baseUrl,
      locale,
      organizationId: invitation.organizationId,
    }),
  );
  const profile = AsyncResult.match(profileResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  });
  const image = assetUrl(profile?.icon ?? profile?.logo ?? null, baseUrl);

  return (
    <AppBrand
      to={null}
      label={
        profile?.displayName ??
        invitation.organizationName ??
        invitation.organizationId
      }
      subtitle={invitation.organizationId}
      icon={Building2}
      className="min-w-48"
      {...(image ? { imageSrc: image } : {})}
    />
  );
}

const userInvitationRowActions = ({
  m,
  actingInvitationId,
  now,
  onAccept,
  onReject,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  actingInvitationId: string | null;
  now: number;
  onAccept: (invitation: UserInvitationSummary) => void;
  onReject: (invitation: UserInvitationSummary) => void;
}) => [
  {
    name: m.organization_invitation_accept(),
    icon: <Check />,
    visible: (invitation: UserInvitationSummary) =>
      actingInvitationId !== invitation.id &&
      !isInvitationExpired(invitation, now),
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
  editingLocale,
  organization,
  onUpdated,
}: {
  authClient: AuthUiClient;
  baseUrl?: string | undefined;
  editingLocale: OrganizationLocale;
  organization: OrganizationSummary;
  onUpdated: () => Promise<void>;
}) {
  const m = useOrganizationMessages();
  const uploadImage = useAtomSet(
    authClientApi(baseUrl).mutation("authExtra", "uploadUserImage"),
    { mode: "promise" },
  );
  const [defaultLocale] = useState(currentOrganizationLocale);
  const defaultValues = organizationFormDefaults(organization, baseUrl);
  const [form] = useState(() =>
    FormReact.make(organizationFormBuilder, {
      fields: organizationFormFields,
      onSubmit: (_, { decoded: value }) =>
        Effect.tryPromise({
          try: async () => {
            const name = organizationNameFromForm(value, defaultLocale);
            if (!name) throw new Error(m.organization_name_required());

            const slug = value.slug.trim().toLowerCase();
            const metadata = await organizationMetadataFromForm(
              value,
              m,
              uploadImage,
              organization.metadata,
            );
            const result = await authClient.organization.update({
              organizationId: organization.id,
              data: { name, slug, metadata },
            });

            if (result.error) {
              throw new Error(
                result.error.message ?? m.organization_update_error(),
              );
            }

            await onUpdated();
            return result.data;
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.organization_update_error()),
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);

  return (
    <section className="flex flex-col gap-4">
      <form.Initialize defaultValues={defaultValues}>
        <form
          className="flex w-full flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            submit();
          }}
        >
          <form.slug label={m.organization_slug()} required />
          <Separator className="my-2" />
          <OrganizationFormSection
            title={m.organization_profile()}
            description={m.organization_translation_description()}
          >
            <FieldSet
              disabled={editingLocale !== "en"}
              className={editingLocale === "en" ? "contents" : "hidden"}
            >
              <form.enName label={m.organization_translation_name()} />
              <form.enLogo
                label={m.organization_logo()}
                size={{
                  width: 175,
                  height: 50,
                  suggestedWidth: 350,
                  suggestedHeight: 100,
                }}
              />
              <form.enIcon
                label={m.organization_icon()}
                size={{
                  width: 96,
                  height: 96,
                  suggestedWidth: 512,
                  suggestedHeight: 512,
                }}
              />
            </FieldSet>
            <FieldSet
              disabled={editingLocale !== "fr"}
              className={editingLocale === "fr" ? "contents" : "hidden"}
            >
              <form.frName label={m.organization_translation_name()} />
              <form.frLogo
                label={m.organization_logo()}
                size={{
                  width: 175,
                  height: 50,
                  suggestedWidth: 350,
                  suggestedHeight: 100,
                }}
              />
              <form.frIcon
                label={m.organization_icon()}
                size={{
                  width: 96,
                  height: 96,
                  suggestedWidth: 512,
                  suggestedHeight: 512,
                }}
              />
            </FieldSet>
          </OrganizationFormSection>
          <Separator className="my-2" />
          <OrganizationFormSection title={m.organization_contact()}>
            <OrganizationContactGroup
              title={m.organization_contact_email_type()}
            >
              <form.emails locale={editingLocale} />
            </OrganizationContactGroup>
            <OrganizationContactGroup
              title={m.organization_contact_phone_type()}
            >
              <form.phones locale={editingLocale} />
            </OrganizationContactGroup>
            <OrganizationContactGroup
              title={m.organization_contact_website_type()}
            >
              <form.websites locale={editingLocale} />
            </OrganizationContactGroup>
            <OrganizationContactGroup
              title={m.organization_contact_social_type()}
            >
              <form.socials locale={editingLocale} />
            </OrganizationContactGroup>
          </OrganizationFormSection>
          <Separator className="my-2" />
          <OrganizationFormSection title={m.organization_address()}>
            <form.addresses locale={editingLocale} />
          </OrganizationFormSection>
          <SubmitError result={submitResult} />
          <SubmitButton form={form} />
        </form>
      </form.Initialize>
    </section>
  );
}

function CreateOrganizationSection({
  authClient,
  baseUrl,
  editingLocale,
  organizations,
  onCreated,
}: {
  authClient: AuthUiClient;
  baseUrl?: string | undefined;
  editingLocale: OrganizationLocale;
  organizations: readonly OrganizationSummary[];
  onCreated: (organization: OrganizationSummary) => Promise<void>;
}) {
  const m = useOrganizationMessages();
  const uploadImage = useAtomSet(
    authClientApi(baseUrl).mutation("authExtra", "uploadUserImage"),
    { mode: "promise" },
  );
  const [defaultLocale] = useState(currentOrganizationLocale);
  const defaultValues = organizationFormDefaults(undefined, baseUrl);
  const [form] = useState(() =>
    FormReact.make(organizationFormBuilder, {
      fields: organizationFormFields,
      onSubmit: (_, { decoded: value }) =>
        Effect.tryPromise({
          try: async () => {
            const name = organizationNameFromForm(value, defaultLocale);
            if (!name) throw new Error(m.organization_name_required());

            const slug = (value.slug.trim() || slugify(name)).toLowerCase();
            const metadata = await organizationMetadataFromForm(
              { ...value, slug },
              m,
              uploadImage,
            );
            const result = await authClient.organization.create({
              name,
              slug,
              metadata,
              ...(value.parentId === noParentOrganization
                ? {}
                : { parentId: value.parentId }),
            });

            if (result.error) {
              throw new Error(
                isOrganizationSlugConflict(result.error)
                  ? m.organization_create_slug_conflict()
                  : (result.error.message ?? m.organization_create_error()),
              );
            }

            await onCreated(result.data);
            return result.data;
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.organization_create_error()),
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);
  const values = useAtomValue(form.values);
  const setSlug = useAtomSet(form.getFieldAtoms(form.fields.slug).setValue);
  const lastGeneratedSlug = useRef("");
  const slugWasEdited = useRef(false);

  useEffect(() => {
    if (Option.isNone(values) || slugWasEdited.current) return;

    if (values.value.slug !== lastGeneratedSlug.current) {
      slugWasEdited.current = true;
      return;
    }

    const generatedSlug = slugify(
      organizationNameFromForm(values.value, defaultLocale),
    );
    if (generatedSlug === values.value.slug) return;

    lastGeneratedSlug.current = generatedSlug;
    setSlug(generatedSlug);
  }, [defaultLocale, setSlug, values]);

  return (
    <section className="flex flex-col gap-4">
      <form.Initialize defaultValues={defaultValues}>
        <form
          className="flex w-full flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            submit();
          }}
        >
          <form.slug
            label={m.organization_slug()}
            description={m.organization_slug_description()}
          />
          <form.parentId
            label={m.organization_parent()}
            description={m.organization_parent_description()}
            options={organizationParentOptions(organizations, m)}
          />
          <Separator className="my-2" />
          <OrganizationFormSection
            title={m.organization_profile()}
            description={m.organization_translation_description()}
          >
            <FieldSet
              disabled={editingLocale !== "en"}
              className={editingLocale === "en" ? "contents" : "hidden"}
            >
              <form.enName label={m.organization_translation_name()} />
              <form.enLogo
                label={m.organization_logo()}
                size={{
                  width: 175,
                  height: 50,
                  suggestedWidth: 350,
                  suggestedHeight: 100,
                }}
              />
              <form.enIcon
                label={m.organization_icon()}
                size={{
                  width: 96,
                  height: 96,
                  suggestedWidth: 512,
                  suggestedHeight: 512,
                }}
              />
            </FieldSet>
            <FieldSet
              disabled={editingLocale !== "fr"}
              className={editingLocale === "fr" ? "contents" : "hidden"}
            >
              <form.frName label={m.organization_translation_name()} />
              <form.frLogo
                label={m.organization_logo()}
                size={{
                  width: 175,
                  height: 50,
                  suggestedWidth: 350,
                  suggestedHeight: 100,
                }}
              />
              <form.frIcon
                label={m.organization_icon()}
                size={{
                  width: 96,
                  height: 96,
                  suggestedWidth: 512,
                  suggestedHeight: 512,
                }}
              />
            </FieldSet>
          </OrganizationFormSection>
          <Separator className="my-2" />
          <OrganizationFormSection title={m.organization_contact()}>
            <OrganizationContactGroup
              title={m.organization_contact_email_type()}
            >
              <form.emails locale={editingLocale} />
            </OrganizationContactGroup>
            <OrganizationContactGroup
              title={m.organization_contact_phone_type()}
            >
              <form.phones locale={editingLocale} />
            </OrganizationContactGroup>
            <OrganizationContactGroup
              title={m.organization_contact_website_type()}
            >
              <form.websites locale={editingLocale} />
            </OrganizationContactGroup>
            <OrganizationContactGroup
              title={m.organization_contact_social_type()}
            >
              <form.socials locale={editingLocale} />
            </OrganizationContactGroup>
          </OrganizationFormSection>
          <Separator className="my-2" />
          <OrganizationFormSection title={m.organization_address()}>
            <form.addresses locale={editingLocale} />
          </OrganizationFormSection>
          <SubmitError result={submitResult} />
          <SubmitButton form={form} />
        </form>
      </form.Initialize>
    </section>
  );
}

function OrganizationFormSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="font-medium">{title}</h3>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function OrganizationContactGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-medium">{title}</h4>
      {children}
    </div>
  );
}

function OrganizationMembersManager({
  authClient,
  baseUrl,
  canManageMembers,
  organization,
  currentUserId,
  active,
  onLeft,
}: {
  authClient: AuthUiClient;
  baseUrl?: string | undefined;
  canManageMembers: boolean;
  organization: OrganizationSummary;
  currentUserId: string;
  active: boolean;
  onLeft: () => Promise<void>;
}) {
  const m = useOrganizationMessages();
  const hasOpened = useOpenedOnce(active);
  const membersAtom = hasOpened
    ? organizationMembersAtom(authClient)(organization.id)
    : emptyOrganizationMembersAtom;
  const membersResult = useAtomValue(membersAtom);
  const refreshMembers = useAtomRefresh(membersAtom);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] = useState<
    string | null
  >(null);
  const [leavingOrganization, setLeavingOrganization] = useState(false);
  const [lastMembersData, setLastMembersData] =
    useState<OrganizationMembersData | null>(null);
  const currentMembersData = AsyncResult.match(membersResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  });
  const membersData = currentMembersData ??
    lastMembersData ?? {
      members: [],
      invitations: [],
    };
  const members = membersData.members;
  const invitations = membersData.invitations;
  const invitationNow = useInvitationExpirationClock(invitations);
  const [memberRoleOverrides, setMemberRoleOverrides] = useState<
    Record<string, string>
  >({});
  const displayedMembers: OrganizationMemberRow[] = members.map((member) => ({
    ...member,
    role: memberRoleOverrides[member.id] ?? member.role,
  }));
  const membersError = AsyncResult.match(membersResult, {
    onInitial: () => null,
    onFailure: () => m.organization_members_load_error(),
    onSuccess: () => null,
  });
  const loading = !lastMembersData && membersResult._tag === "Initial";
  const canInviteMembers = canManageMembers;
  const canRemoveMembers = canManageMembers;

  useEffect(() => {
    if (!currentMembersData) return;

    setLastMembersData(currentMembersData);
  }, [currentMembersData]);

  const [inviteForm] = useState(() =>
    FormReact.make(inviteMemberFormBuilder, {
      fields: {
        email: TextField,
        role: SelectField,
      },
      onSubmit: (_, { decoded: value }) =>
        Effect.tryPromise({
          try: async () => {
            const result = await authClient.organization.inviteMember({
              email: value.email.trim(),
              role: normalizeInvitationRole(value.role),
              organizationId: organization.id,
            });

            if (result.error) {
              throw new Error(
                result.error.message ?? m.organization_invite_error(),
              );
            }

            refreshMembers();
            return result.data;
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.organization_invite_error()),
        }),
    }),
  );
  const submitInvitation = useAtomSet(inviteForm.submit);
  const resetInvitation = useAtomSet(inviteForm.reset);
  const inviteResult = useAtomValue(inviteForm.submit);

  useEffect(() => {
    if (!AsyncResult.isSuccess(inviteResult)) return;
    resetInvitation();
    setInviting(false);
  }, [inviteResult, resetInvitation]);

  const updateRole = async (
    member: OrganizationMemberRow,
    role: OrganizationRole | OrganizationRole[],
  ) => {
    setError(null);
    const nextRole = Array.isArray(role)
      ? Array.from(new Set(role)).join(",")
      : normalizeOrganizationRole(role);

    setMemberRoleOverrides((current) => ({
      ...current,
      [member.id]: nextRole,
    }));

    const result = await authClient.organization.updateMemberRole({
      memberId: member.id,
      role: Array.isArray(role) ? role : normalizeOrganizationRole(role),
      organizationId: organization.id,
    });

    if (result.error) {
      setMemberRoleOverrides((current) => ({
        ...current,
        [member.id]: member.role,
      }));
      setError(result.error.message ?? m.organization_member_role_error());
    }
  };

  const removeMember = async (member: OrganizationMemberRow) => {
    setError(null);

    const result = await authClient.organization.removeMember({
      memberIdOrEmail: member.id,
      organizationId: organization.id,
    });

    if (result.error) {
      setError(result.error.message ?? m.organization_member_remove_error());
      return;
    }

    refreshMembers();
  };

  const leaveOrganization = async () => {
    setLeavingOrganization(true);
    setError(null);

    const result = await authClient.organization.leave({
      organizationId: organization.id,
    });

    setLeavingOrganization(false);

    if (result.error) {
      setError(result.error.message ?? m.organization_member_leave_error());
      return;
    }

    await onLeft();
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
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">
          {inviting
            ? m.organization_invite_member_title()
            : m.organization_members_title()}
        </DialogTitle>
        <DialogDescription>
          {inviting
            ? m.organization_invite_member_description()
            : m.organization_members_dialog_description({
                name: organization.name,
              })}
        </DialogDescription>
        {inviting ? (
          <Button
            className="mt-2 w-fit"
            onClick={() => setInviting(false)}
            type="button"
            variant="secondary"
          >
            <ArrowLeft />
            {m.organization_back()}
          </Button>
        ) : canInviteMembers ? (
          <Button
            className="mt-2 w-fit"
            onClick={() => setInviting(true)}
            type="button"
          >
            <UserPlus />
            {m.organization_invite_member_title()}
          </Button>
        ) : null}
      </DialogHeader>
      <Separator />
      <div className="flex min-w-0 flex-col gap-5">
        {inviting ? (
          <inviteForm.Initialize defaultValues={{ email: "", role: "member" }}>
            <form
              className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                submitInvitation();
              }}
            >
              <inviteForm.email
                label={m.organization_member_email()}
                placeholder="teammate@example.com"
                type="email"
                required
              />
              <inviteForm.role
                label={m.organization_member_role()}
                options={organizationRoles.map((role) => ({
                  label: organizationRoleLabel(role, m),
                  value: role,
                }))}
              />
              <div className="self-end">
                <SubmitButton form={inviteForm} />
              </div>
              <SubmitError result={inviteResult} />
            </form>
          </inviteForm.Initialize>
        ) : null}
        {!inviting && membersError ? (
          <p className="text-destructive text-sm">{membersError}</p>
        ) : null}
        {!inviting && error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : null}
        {!inviting ? (
          <section className="flex min-w-0 flex-col gap-3">
            <div>
              <h3 className="font-medium">
                {m.organization_members_heading()}
              </h3>
              <p className="text-muted-foreground text-sm">
                {m.organization_members_description()}
              </p>
            </div>
            <div className="-m-1 min-w-0 overflow-x-auto p-1">
              <DataTable
                columns={memberColumns({
                  m,
                  baseUrl,
                  canChangeRoles: canManageMembers,
                  onRoleChange: updateRole,
                })}
                data={displayedMembers}
                features={{
                  export: { baseName: `${organization.slug}-members` },
                  gallery: false,
                  rowActions: {
                    items: memberRowActions({
                      m,
                      canRemoveMembers,
                      currentUserId,
                      leavingOrganization,
                      onLeave: leaveOrganization,
                      onRemove: removeMember,
                    }),
                  },
                }}
                searchState="local"
                state={{ empty: m.organization_members_empty(), loading }}
              />
            </div>
          </section>
        ) : null}
        {!inviting ? (
          <section className="flex min-w-0 flex-col gap-3">
            <div>
              <h3 className="font-medium">
                {m.organization_invitations_heading()}
              </h3>
              <p className="text-muted-foreground text-sm">
                {m.organization_invitations_description()}
              </p>
            </div>
            <div className="-m-1 min-w-0 overflow-x-auto p-1">
              <DataTable
                columns={invitationColumns({
                  m,
                  now: invitationNow,
                })}
                data={invitations}
                features={{
                  export: { baseName: `${organization.slug}-invitations` },
                  gallery: false,
                  rowActions: {
                    items: invitationRowActions({
                      m,
                      cancellingInvitationId,
                      onCancel: cancelInvitation,
                    }),
                  },
                }}
                searchState="local"
                state={{ empty: m.organization_invitations_empty(), loading }}
              />
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

const memberColumns = ({
  m,
  baseUrl,
  canChangeRoles,
  onRoleChange,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  baseUrl?: string | undefined;
  canChangeRoles: boolean;
  onRoleChange: (
    member: OrganizationMemberRow,
    role: OrganizationRole | OrganizationRole[],
  ) => void;
}): ColumnDef<OrganizationMemberRow>[] => [
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
      const roles = normalizeOrganizationRoles(member.role);
      const roleOptions = roles.map((role) => ({
        label: organizationRoleLabel(role, m),
        value: role,
      }));

      if (!canChangeRoles) {
        return (
          <div className="flex flex-wrap gap-1">
            {roleOptions.map((role) => (
              <Badge key={role.value} variant="secondary">
                {role.label}
              </Badge>
            ))}
          </div>
        );
      }

      return (
        <DataTableRelationshipCell
          emptyLabel={m.organization_member_role()}
          manageLabel={m.organization_member_role()}
          options={organizationRoles.map((role) => ({
            label: organizationRoleLabel(role, m),
            value: role,
          }))}
          value={roleOptions}
          onAdd={(value) => {
            if (!isOrganizationRole(value)) return;
            onRoleChange(member, Array.from(new Set([...roles, value])));
          }}
          onRemove={(value) => {
            if (!isOrganizationRole(value)) return;
            const nextRoles = roles.filter((role) => role !== value);
            onRoleChange(member, nextRoles.length > 0 ? nextRoles : ["member"]);
          }}
        />
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
  canRemoveMembers,
  currentUserId,
  leavingOrganization,
  onLeave,
  onRemove,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  canRemoveMembers: boolean;
  currentUserId: string;
  leavingOrganization: boolean;
  onLeave: (member: OrganizationMemberRow) => void;
  onRemove: (member: OrganizationMemberRow) => void;
}) => [
  {
    name: m.organization_member_leave(),
    icon: <LogOut />,
    variant: "destructive" as const,
    visible: (member: OrganizationMemberRow) =>
      member.userId === currentUserId && !leavingOrganization,
    onClick: onLeave,
  },
  {
    name: m.organization_member_remove(),
    icon: <Trash2 />,
    variant: "destructive" as const,
    visible: (member: OrganizationMemberRow) =>
      canRemoveMembers &&
      member.userId !== currentUserId &&
      normalizeOrganizationRole(member.role) !== "owner",
    onClick: onRemove,
  },
];

const invitationColumns = ({
  m,
  now,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  now: number;
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
    cell: ({ row }) => (
      <Badge
        variant={
          isInvitationExpired(row.original, now) ? "destructive" : "default"
        }
      >
        {invitationStatusLabel(invitationDisplayStatus(row.original, now), m)}
      </Badge>
    ),
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
  permissions,
}: {
  authClient: AuthUiClient;
  organization: OrganizationSummary;
  active: boolean;
  permissions: Readonly<Record<string, ReadonlyArray<string>>>;
}) {
  const m = useOrganizationMessages();
  const hasOpened = useOpenedOnce(active);
  const keysAtom = hasOpened
    ? organizationApiKeysAtom(authClient)(organization.id)
    : emptyOrganizationApiKeysAtom;
  const keysResult = useAtomValue(keysAtom);
  const refreshKeys = useAtomRefresh(keysAtom);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const permissionOptions = organizationApiKeyPermissionOptions(permissions);
  const [selectedPermissions, setSelectedPermissions] = useState<
    Record<string, boolean>
  >({});
  const permissionOptionsRef = useRef(permissionOptions);
  const selectedPermissionsRef = useRef(selectedPermissions);
  permissionOptionsRef.current = permissionOptions;
  selectedPermissionsRef.current = selectedPermissions;
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

  const [createForm] = useState(() =>
    FormReact.make(apiKeyFormBuilder, {
      fields: { name: TextField, referrers: TextAreaField },
      onSubmit: (_, { decoded: value }) =>
        Effect.tryPromise({
          try: async () => {
            setCreatedKey(null);
            const created = await createApiKey(
              {
                configId: "organization",
                organizationId: organization.id,
                name: value.name.trim(),
                permissions: organizationApiKeySelectedPermissions(
                  permissionOptionsRef.current,
                  selectedPermissionsRef.current,
                ),
                referrers: parseApiKeyReferrers(
                  value.referrers,
                  m.user_api_key_referrers_error(),
                ),
              },
              m.user_api_key_create_error(),
            );

            setCreatedKey(created.key);
            setSelectedPermissions({});
            refreshKeys();
            return created;
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.user_api_key_create_error()),
        }),
    }),
  );
  const submitApiKey = useAtomSet(createForm.submit);
  const resetApiKey = useAtomSet(createForm.reset);
  const createResult = useAtomValue(createForm.submit);

  const togglePermission = (id: string, checked: boolean) => {
    setSelectedPermissions((current) => ({ ...current, [id]: checked }));
  };

  useEffect(() => {
    if (AsyncResult.isSuccess(createResult)) resetApiKey();
  }, [createResult, resetApiKey]);

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
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">
          {editingKey
            ? m.user_api_key_edit_title()
            : createdKey
              ? m.user_api_key_created_title()
              : creating
                ? m.user_api_key_create_title()
                : m.user_api_keys_title()}
        </DialogTitle>
        <DialogDescription>
          {editingKey
            ? m.user_api_key_edit_description()
            : createdKey
              ? m.user_api_key_created_description()
              : creating
                ? m.user_api_key_create_description()
                : m.user_api_keys_organization_description({
                    name: organization.name,
                  })}
        </DialogDescription>
        {creating || editingKey ? (
          <Button
            className="mt-2 w-fit"
            onClick={() => {
              setCreating(false);
              setCreatedKey(null);
              setEditingKey(null);
            }}
            type="button"
            variant="secondary"
          >
            <ArrowLeft />
            {m.user_api_key_back()}
          </Button>
        ) : (
          <Button
            className="mt-2 w-fit"
            onClick={() => {
              setCreatedKey(null);
              setCreating(true);
            }}
            type="button"
          >
            <Plus />
            {m.user_api_key_create_title()}
          </Button>
        )}
      </DialogHeader>
      <Separator />
      <div className="flex min-w-0 flex-col gap-5">
        {creating && !createdKey ? (
          <section className="w-full">
            <createForm.Initialize defaultValues={{ name: "", referrers: "" }}>
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  submitApiKey();
                }}
              >
                <createForm.name label={m.user_api_key_name()} required />
                <createForm.referrers
                  label={m.user_api_key_referrers()}
                  description={m.user_api_key_referrers_description()}
                  placeholder={m.user_api_key_referrers_placeholder()}
                  rows={3}
                />
                <ApiKeyPermissions
                  description={m.user_api_key_permissions_description()}
                  idPrefix="organization-create"
                  permissions={permissions}
                  selected={selectedPermissions}
                  title={m.user_api_key_permissions()}
                  onChange={togglePermission}
                />
                <SubmitError result={createResult} />
                <SubmitButton form={createForm} />
              </form>
            </createForm.Initialize>
          </section>
        ) : null}
        {creating && createdKey ? (
          <div className="flex min-w-0 flex-col gap-3">
            <div className="bg-muted/50 flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2">
              <code className="block min-w-0 flex-1 overflow-x-auto text-sm whitespace-nowrap">
                {createdKey}
              </code>
              <CopyButton
                className="shrink-0"
                messages={{
                  copied: m.user_api_key_copied(),
                  copy: m.user_api_key_copy(),
                }}
                value={createdKey}
                variant="ghost"
              />
            </div>
          </div>
        ) : null}
        {!creating && !editingKey && keysError ? (
          <p className="text-destructive text-sm">{keysError}</p>
        ) : null}
        {!creating && !editingKey && error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : null}
        {!creating && !editingKey ? (
          <div className="max-w-full min-w-0 overflow-x-hidden">
            <DataTable
              columns={apiKeyColumns({ m })}
              data={keys}
              features={{
                export: { baseName: `${organization.slug}-api-keys` },
                gallery: false,
                rowActions: {
                  items: apiKeyRowActions({
                    m,
                    onDelete: deleteKey,
                    onEdit: (key) => setEditingKey(key),
                  }),
                },
              }}
              searchState="local"
              state={{
                empty: loading ? m.user_loading() : m.table_empty(),
                loading,
              }}
            />
          </div>
        ) : null}
        {editingKey ? (
          <ApiKeyEditForm
            key={editingKey.id}
            configId="organization"
            keyData={editingKey}
            permissions={permissions}
            messages={{
              enabled: m.user_api_key_enabled(),
              name: m.user_api_key_name(),
              referrers: m.user_api_key_referrers(),
              referrersDescription: m.user_api_key_referrers_description(),
              referrersError: m.user_api_key_referrers_error(),
              referrersPlaceholder: m.user_api_key_referrers_placeholder(),
              permissions: m.user_api_key_permissions(),
              permissionsDescription: m.user_api_key_permissions_description(),
              updateError: m.user_api_key_update_error(),
            }}
            onSaved={() => {
              refreshKeys();
              setEditingKey(null);
            }}
          />
        ) : null}
      </div>
    </>
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
  {
    id: "permissions",
    accessorFn: (keyData) => keyData.permissions,
    header: m.user_api_key_permissions(),
    cell: ({ row }) => {
      const values = organizationApiKeyFormattedPermissions(
        row.original.permissions,
      );
      return values.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {values.map((value) => (
            <Badge key={value} variant="outline">
              {value}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">
          {m.user_api_key_no_permissions()}
        </span>
      );
    },
  },
  {
    id: "referrers",
    accessorFn: (keyData) => keyData.metadata,
    header: m.user_api_key_referrers_column(),
    cell: ({ row }) => (
      <ApiKeyReferrers
        metadata={row.original.metadata}
        unrestrictedLabel={m.user_api_key_referrers_any()}
      />
    ),
  },
  {
    id: "rateLimit",
    accessorFn: apiKeyUsagePercent,
    header: m.user_api_key_rate_limit(),
    cell: ({ row }) => (
      <ApiKeyRateLimit
        keyData={row.original}
        messages={{
          disabled: m.user_api_key_disabled(),
          none: m.user_api_key_window_none(),
          unlimited: m.user_api_key_unlimited(),
          usage: m.user_api_key_usage(),
          windowDays: (count) => m.user_api_key_window_days({ count }),
          windowHours: (count) => m.user_api_key_window_hours({ count }),
          windowMinutes: (count) => m.user_api_key_window_minutes({ count }),
          windowSeconds: (count) => m.user_api_key_window_seconds({ count }),
        }}
      />
    ),
  },
];

const organizationApiKeyPermissionOptions = (
  permissions: Readonly<Record<string, ReadonlyArray<string>>>,
) =>
  Object.entries(permissions).flatMap(([resource, actions]) =>
    actions.map((action) => ({
      id: `${resource}:${action}`,
      resource,
      action,
    })),
  );

const organizationApiKeySelectedPermissions = (
  options: ReturnType<typeof organizationApiKeyPermissionOptions>,
  selected: Record<string, boolean>,
) => {
  const permissions: Record<string, string[]> = {};
  for (const option of options) {
    if (!selected[option.id]) continue;
    permissions[option.resource] = [
      ...(permissions[option.resource] ?? []),
      option.action,
    ];
  }
  return permissions;
};

const organizationApiKeyFormattedPermissions = (value: unknown) => {
  const decoded = Schema.decodeUnknownOption(
    Schema.Record(Schema.String, Schema.Array(Schema.String)),
  )(value);
  return Option.isSome(decoded)
    ? Object.entries(decoded.value).flatMap(([resource, actions]) =>
        actions.map((action) => `${resource}:${action}`),
      )
    : [];
};

const apiKeyRowActions = ({
  m,
  onDelete,
  onEdit,
}: {
  m: ReturnType<typeof organizationMessageFns>;
  onDelete: (key: ApiKeySummary) => void;
  onEdit: (key: ApiKeySummary) => void;
}) => [
  {
    name: m.user_api_key_edit_title(),
    icon: <PencilIcon />,
    onClick: onEdit,
  },
  {
    name: m.user_delete(),
    icon: <Trash2 />,
    variant: "destructive" as const,
    onClick: onDelete,
  },
];
