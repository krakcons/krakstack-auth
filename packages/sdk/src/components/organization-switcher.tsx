import type {
  AuthApiKey as ApiKey,
  AuthInvitation,
  AuthMember,
  AuthOrganization,
} from "../auth/schema.js";
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { Effect, Option, Predicate, Schema } from "effect";
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
  type DataTableColDef,
  DataTableListSummary,
  DataTableRelationshipCell,
} from "@krak-stack/registry/data-table";
import {
  CheckboxField,
  ImageField,
  SelectField,
  SubmitButton,
  SubmitError,
  TextAreaField,
  TextField,
} from "@krak-stack/registry/effect-form";
import { EditingLocaleSwitcher } from "@krak-stack/registry/editing-locale-switcher";
import { AppBrand } from "@krak-stack/registry/app-brand";
import { FieldSet } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@krak-stack/registry/copy-button";
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
} from "@krak-stack/auth/schema";
import {
  isOrganizationRole,
  normalizeOrganizationRole,
  normalizeOrganizationRoles,
  organizationRoles,
  parseRoleList,
  type OrganizationRole,
} from "../roles.js";

import { authClientApi, authHttpClient } from "./auth-client-api.js";
import {
  activeAuthOrganizationAtom,
  authOrganizationsAtom,
  authSessionAtom,
  notifyAuthChange,
} from "./auth-atoms.js";
import { useKrakstackAuth } from "./auth-provider.js";
import { parseApiKeyReferrers } from "./api-key.js";
import { ApiKeyPermissions } from "./api-key-permissions.js";
import { ApiKeyRateLimit, apiKeyUsagePercent } from "./api-key-rate-limit.js";
import { ApiKeyReferrers, apiKeyReferrers } from "./api-key-referrers.js";
import {
  ContactAddressesField,
  ContactEmailsField,
  ContactPhonesField,
  ContactSocialsField,
  ContactWebsitesField,
  type ContactAddressFieldMessages,
} from "./contact-fields.js";
import { useOpenedOnce } from "./hooks.js";
import {
  invitationDisplayStatus,
  isInvitationExpired,
  useInvitationExpirationClock,
} from "./invitation-expiration.js";
import { ExtraUploadedAsset } from "../extra/schema.js";
import { assetPath, assetUrl, cn } from "./utils.js";
import type { ProjectAccessLabelCatalog } from "../access.js";
import { ExtraApiKeyPermissions } from "../extra/schema.js";

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
    user_api_key_permissions_clear_all: "Clear all",
    user_api_key_permissions: "Permissions",
    user_api_key_permissions_description:
      "Choose the project permissions this API key should receive.",
    user_api_key_permissions_select_all: "Select all",
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
    user_api_key_permissions_clear_all: "Tout effacer",
    user_api_key_permissions: "Autorisations",
    user_api_key_permissions_description:
      "Choisissez les autorisations de projet à attribuer à cette clé API.",
    user_api_key_permissions_select_all: "Tout sélectionner",
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
type OrganizationMessageFunction = (
  params?: Record<string, string | number>,
) => string;

const interpolate = (value: string, params?: Record<string, string | number>) =>
  params
    ? value.replace(/\{([^}]+)\}/g, (_, key: string) =>
        String(params[key] ?? `{${key}}`),
      )
    : value;

const interpolateMessage = (
  labels: OrganizationSwitcherLabels,
  key: string,
  params?: Record<string, string | number>,
) => {
  const entry = Object.entries(labels).find(([labelKey]) => labelKey === key);
  return interpolate(entry?.[1] ?? key, params);
};

const organizationMessageFns = (labels: OrganizationSwitcherLabels) => {
  return new Proxy<Record<string, OrganizationMessageFunction>>(
    {},
    {
      get:
        (_target, key: string) => (params?: Record<string, string | number>) =>
          interpolateMessage(labels, key, params),
    },
  );
};

const OrganizationMessagesContext = createContext(
  organizationMessageFns(organizationSwitcherMessages()),
);
const useOrganizationMessages = () => useContext(OrganizationMessagesContext);

const organizationContactFieldMessages = (
  m: ReturnType<typeof organizationMessageFns>,
): ContactAddressFieldMessages => ({
  addAddress: m.organization_address_add(),
  addEmail: m.organization_contact_add_email(),
  addPhone: m.organization_contact_add_phone(),
  addSocial: m.organization_contact_add_social(),
  addWebsite: m.organization_contact_add_website(),
  country: m.organization_address_country(),
  email: m.organization_contact_email_type(),
  extension: m.organization_contact_extension(),
  label: m.organization_contact_label(),
  locality: m.organization_address_locality(),
  phone: m.organization_contact_phone_type(),
  platform: m.organization_contact_platform(),
  postalCode: m.organization_address_postal_code(),
  region: m.organization_address_region(),
  remove: m.organization_contact_remove(),
  street: m.organization_address_street(),
  url: m.organization_contact_url(),
});

export type OrganizationSwitcherFeatures = {
  organizationSwitching?: boolean;
  organizationCreation?: boolean;
  userInvitations?: boolean;
};

export type OrganizationSwitcherProps = {
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
  metadata?: unknown | undefined;
  userId?: string | null | undefined;
  parentId?: string | null | undefined;
};

export type OrganizationSwitcherDialog =
  | "create"
  | "manage"
  | "members"
  | "apiKeys"
  | "invitations";
type ApiKeySummary = Omit<ApiKey, "key">;
type OrganizationMemberSummary = AuthMember;
type OrganizationInvitationSummary = AuthInvitation;
type UserInvitationSummary = OrganizationInvitationSummary;
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

const userInvitationsAtom = Atom.family((baseUrl?: string | undefined) =>
  authClientApi(baseUrl).query("auth", "organizationListUserInvitations", {
    query: {},
    timeToLive: "1 minute",
    reactivityKeys: ["auth-user-invitations"],
  }),
);

const invitationOrganizationProfileAtom = Atom.family(
  (baseUrl?: string | undefined) =>
    Atom.family((organizationId: string) =>
      Atom.family((locale: OrganizationLocale) =>
        authClientApi(baseUrl).query(
          "authExtra",
          "getOrganizationPublicProfile",
          {
            query: { locale, organizationId },
            timeToLive: "5 minutes",
            serializationKey: `invitation-organization:${organizationId}:${locale}`,
          },
        ),
      ),
    ),
);

const organizationMembersAtom = Atom.family((baseUrl?: string | undefined) =>
  Atom.family((organizationId: string) =>
    authClientApi(baseUrl).query("auth", "organizationListMembers", {
      query: { organizationId },
      timeToLive: "1 minute",
      reactivityKeys: ["auth-organization-members", organizationId],
      serializationKey: `organization-members:${organizationId}`,
    }),
  ),
);

const organizationInvitationsAtom = Atom.family(
  (baseUrl?: string | undefined) =>
    Atom.family((organizationId: string) =>
      authClientApi(baseUrl).query("auth", "organizationListInvitations", {
        query: { organizationId },
        timeToLive: "1 minute",
        reactivityKeys: ["auth-organization-invitations", organizationId],
        serializationKey: `organization-invitations:${organizationId}`,
      }),
    ),
);

const emptyOrganizationMembersAtom = Atom.make(
  Effect.succeed({ members: Array<OrganizationMemberSummary>(), total: 0 }),
);

const emptyOrganizationInvitationsAtom = Atom.make(
  Effect.succeed(Array<OrganizationInvitationSummary>()),
);

const organizationApiKeysAtom = Atom.family((baseUrl?: string | undefined) =>
  Atom.family((organizationId: string) =>
    authClientApi(baseUrl).query("auth", "apiKeyList", {
      query: { configId: "organization", organizationId },
      timeToLive: "1 minute",
      reactivityKeys: ["auth-organization-api-keys", organizationId],
      serializationKey: `organization-api-keys:${organizationId}`,
    }),
  ),
);

const emptyOrganizationApiKeysAtom = Atom.make(
  Effect.succeed({
    apiKeys: Array<ApiKeySummary>(),
    total: 0,
  }),
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

const organizationFormFields = {
  parentId: SelectField,
  slug: TextField,
  emails: ContactEmailsField,
  phones: ContactPhonesField,
  websites: ContactWebsitesField,
  socials: ContactSocialsField,
  addresses: ContactAddressesField,
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

const editApiKeyFormBuilder = FormBuilder.empty
  .addField("name", Schema.NonEmptyString)
  .addField("enabled", Schema.Boolean)
  .addField("referrers", Schema.String)
  .addField("permissions", Schema.Record(Schema.String, Schema.Boolean));

type ApiKeyPermissionsFieldOptions = {
  clearAllLabel: string;
  description: string;
  idPrefix: string;
  labels?: ProjectAccessLabelCatalog | undefined;
  permissions: Readonly<Record<string, ReadonlyArray<string>>>;
  selectAllLabel: string;
  title: string;
};

const ApiKeyPermissionsField: FormReact.FieldComponent<
  Readonly<Record<string, boolean>>,
  ApiKeyPermissionsFieldOptions
> = ({ field, props }) => (
  <ApiKeyPermissions
    clearAllLabel={props.clearAllLabel}
    description={props.description}
    idPrefix={props.idPrefix}
    permissions={props.permissions}
    labels={props.labels}
    selectAllLabel={props.selectAllLabel}
    selected={field.value}
    title={props.title}
    onChange={(id, checked) =>
      field.onChange({ ...field.value, [id]: checked })
    }
    onChangeAll={(ids, checked) =>
      field.onChange({
        ...field.value,
        ...Object.fromEntries(ids.map((id) => [id, checked])),
      })
    }
  />
);

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const noParentOrganization = "__none__";

const OrganizationFailure = Schema.Struct({
  code: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
});

const isOrganizationSlugConflict = (cause: unknown) => {
  const decoded = Schema.decodeUnknownOption(OrganizationFailure)(cause);
  if (Option.isNone(decoded)) return false;

  return [decoded.value.code, decoded.value.message].some((value) => {
    if (!value) return false;
    const normalized = value.toLowerCase().replaceAll("_", " ");

    return normalized.includes("organization already exists");
  });
};

const organizationFailureMessage = (cause: unknown, fallback: string) => {
  const decoded = Schema.decodeUnknownOption(OrganizationFailure)(cause);
  return Option.isSome(decoded)
    ? (decoded.value.message ?? fallback)
    : fallback;
};

const decodeUploadedAsset = Schema.decodeUnknownEffect(ExtraUploadedAsset);
const OrganizationMetadataRecord = Schema.Record(Schema.String, Schema.Json);

const normalizeOrganizationMetadata = (metadata: OrganizationMetadata) =>
  Schema.decodeUnknownEffect(OrganizationMetadataRecord)(metadata);

const uploadImageAsset = (
  file: File,
  m: ReturnType<typeof organizationMessageFns>,
  uploadImage: (input: {
    payload: FormData;
  }) => Effect.Effect<typeof Schema.Unknown.Type, unknown>,
) => {
  const payload = new FormData();
  payload.append("file", file);

  return uploadImage({ payload }).pipe(
    Effect.flatMap(decodeUploadedAsset),
    Effect.map((uploaded) => assetPath(uploaded.url)),
    Effect.mapError(() => new Error(m.organization_logo_upload_error())),
  );
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

const organizationLogoFromForm = (
  value: File | string | null | undefined,
  m: ReturnType<typeof organizationMessageFns>,
  uploadImage: (input: {
    payload: FormData;
  }) => Effect.Effect<typeof Schema.Unknown.Type, unknown>,
) => {
  if (value instanceof File) return uploadImageAsset(value, m, uploadImage);
  if (Schema.is(Schema.String)(value)) return Effect.succeed(assetPath(value));
  return Effect.succeed(null);
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

const organizationMetadataFromForm = Effect.fn(function* (
  value: OrganizationFormValues,
  m: ReturnType<typeof organizationMessageFns>,
  uploadImage: (input: {
    payload: FormData;
  }) => Effect.Effect<typeof Schema.Unknown.Type, unknown>,
  existingMetadata?: typeof Schema.Unknown.Type,
) {
  const existing = parseOrganizationMetadata(existingMetadata);
  const preservedMetadata = Option.getOrElse(
    Schema.decodeUnknownOption(
      Schema.Union([
        OrganizationMetadataRecord,
        Schema.fromJsonString(OrganizationMetadataRecord),
      ]),
    )(existingMetadata),
    () => ({}),
  );
  const translations: OrganizationTranslation[] = [];
  const enName = value.enName.trim();
  const frName = value.frName.trim();
  const enLogo = yield* organizationLogoFromForm(value.enLogo, m, uploadImage);
  const enIcon = yield* organizationLogoFromForm(value.enIcon, m, uploadImage);
  const frLogo = yield* organizationLogoFromForm(value.frLogo, m, uploadImage);
  const frIcon = yield* organizationLogoFromForm(value.frIcon, m, uploadImage);
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
    if (!number) return [];
    const extension = phone.extension?.trim();
    const result: OrganizationPhoneValue = extension
      ? { number, extension, translations: localized(phone.translations) }
      : { number, translations: localized(phone.translations) };
    return [result];
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
    let normalized: Omit<OrganizationAddressValue, "translations"> = {};
    const streetAddress = input.streetAddress?.trim();
    const locality = input.locality?.trim();
    const region = input.region?.trim();
    const postalCode = input.postalCode?.trim();
    const country = input.country?.trim();
    if (streetAddress) normalized = { ...normalized, streetAddress };
    if (locality) normalized = { ...normalized, locality };
    if (region) normalized = { ...normalized, region };
    if (postalCode) normalized = { ...normalized, postalCode };
    if (country) normalized = { ...normalized, country };
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
});

export function OrganizationSwitcher({
  baseUrl: providedBaseUrl,
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
  const baseUrl = providedBaseUrl ?? auth?.baseUrl;

  const labels = organizationSwitcherMessages(messages);
  const m = organizationMessageFns(labels);
  const sessionAtom = authSessionAtom(baseUrl);
  const organizationsAtom = authOrganizationsAtom(baseUrl);
  const sessionResult = useAtomValue(sessionAtom);
  const organizationsResult = useAtomValue(organizationsAtom);
  const session = AsyncResult.match(sessionResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  });
  const activeOrganizationId = session?.session.activeOrganizationId ?? null;
  const activeOrganizationAtom =
    activeAuthOrganizationAtom(baseUrl)(activeOrganizationId);
  const activeOrganizationResult = useAtomValue(activeOrganizationAtom);
  const activeOrganization = AsyncResult.match(activeOrganizationResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  });
  const organizations = AsyncResult.match(organizationsResult, {
    onInitial: () => Array<AuthOrganization>(),
    onFailure: () => Array<AuthOrganization>(),
    onSuccess: ({ value }) => Array.from(value),
  });
  const organizationsError = AsyncResult.match(organizationsResult, {
    onInitial: () => null,
    onFailure: () => m.organization_switcher_empty(),
    onSuccess: () => null,
  });
  const refreshSession = useAtomRefresh(sessionAtom);
  const refreshOrganizations = useAtomRefresh(organizationsAtom);
  const refreshActiveOrganization = useAtomRefresh(activeOrganizationAtom);
  const setActiveOrganization = (organizationId: string) =>
    authHttpClient(baseUrl).pipe(
      Effect.flatMap((client) =>
        client.auth.organizationSetActive({
          payload: { organizationId },
        }),
      ),
    );
  const lastAuthRefreshVersion = useRef(auth?.authRefreshVersion ?? 0);
  const [uncontrolledDialog, setUncontrolledDialog] =
    useState<OrganizationSwitcherDialog | null>(defaultDialog);
  const [editingOrganizationLocale, setEditingOrganizationLocale] =
    useState<OrganizationLocale>(currentOrganizationLocale);
  const dialog =
    controlledDialog !== undefined ? controlledDialog : uncontrolledDialog;
  const invitationsAtom = userInvitationsAtom(baseUrl);
  const invitationsResult = useAtomValue(invitationsAtom);
  const refreshUserInvitations = useAtomRefresh(invitationsAtom);
  const userInvitations = AsyncResult.match(invitationsResult, {
    onInitial: () => [],
    onFailure: () => [],
    onSuccess: ({ value }) =>
      Array.from(value).filter((invitation) => invitation.status === "pending"),
  });
  const userInvitationsError = AsyncResult.match(invitationsResult, {
    onInitial: () => null,
    onFailure: () => m.organization_invitations_load_error(),
    onSuccess: () => null,
  });
  const loadingUserInvitations = invitationsResult._tag === "Initial";
  const activeMemberRoles = parseRoleList(
    activeOrganization?.members.find(
      (member) => member.userId === session?.user.id,
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
    const nextDialog = Predicate.isFunction(next) ? next(dialog) : next;

    if (nextDialog === dialog) return;
    if (controlledDialog === undefined) setUncontrolledDialog(nextDialog);
    onDialogChange?.(nextDialog);
  };
  const openCreate = () => setDialog("create");

  const refresh = async () => {
    refreshOrganizations();
    refreshActiveOrganization();
    refreshSession();
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

  if (!session) {
    return <>{renderUnauthenticated?.()}</>;
  }

  const active = activeOrganization;
  const activeName = active?.name;
  const visibleOrganizations = organizations.filter(
    (organization) =>
      !allowedOrganizationIds ||
      allowedOrganizationIds.includes(organization.id),
  );
  const selectableOrganizations = canSwitchOrganizations
    ? visibleOrganizations.filter(
        (organization) => organization.id !== active?.id,
      )
    : [];
  const scrollOrganizationList = selectableOrganizations.length > 5;
  const hasOrganizationListItems =
    organizationsResult._tag === "Initial" ||
    Boolean(organizationsError) ||
    canSwitchOrganizations;

  const refreshAfterInvitationAction = async (previousActiveId?: string) => {
    refreshUserInvitations();
    await refresh();

    if (!canSwitchOrganizations && previousActiveId) {
      try {
        await Effect.runPromise(setActiveOrganization(previousActiveId));
        notifyAuthChange();
        await refresh();
        onChange?.(
          organizations.find(
            (organization) => organization.id === previousActiveId,
          ) ?? null,
        );
      } catch {
        // The invitation action succeeded; keep the newly active organization.
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
            className="max-w-[calc(100vw-1rem)] min-w-64 rounded-lg"
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
              {organizationsResult._tag === "Initial" ? (
                <DropdownMenuItem disabled>
                  {m.organization_loading()}
                </DropdownMenuItem>
              ) : null}
              {organizationsError ? (
                <DropdownMenuItem disabled>
                  {organizationsError}
                </DropdownMenuItem>
              ) : null}
              {canSwitchOrganizations && selectableOrganizations.length ? (
                <div
                  className={cn(
                    scrollOrganizationList &&
                      "max-h-64 overflow-y-auto overscroll-contain",
                  )}
                >
                  {selectableOrganizations.map((organization) => {
                    const display = organizationDisplay(
                      organization,
                      m,
                      baseUrl,
                    );

                    return (
                      <DropdownMenuItem
                        key={organization.id}
                        onClick={async () => {
                          try {
                            const result = await Effect.runPromise(
                              setActiveOrganization(organization.id),
                            );
                            if (!result) return;
                            notifyAuthChange();
                            await refresh();
                            onChange?.(organization);
                          } catch {
                            // Switching previously failed silently in this menu.
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
                          {...(display.image
                            ? { imageSrc: display.image }
                            : {})}
                        />
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              ) : canSwitchOrganizations &&
                organizationsResult._tag !== "Initial" ? (
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
              {activeOrganization ? (
                <>
                  <DropdownMenuSeparator />
                  {(() => {
                    const organizationId = activeOrganization.id;

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
            baseUrl={baseUrl}
            editingLocale={editingOrganizationLocale}
            organizations={visibleOrganizations}
            onCreated={async (organization) => {
              setDialog(null);
              let activated = false;
              try {
                await Effect.runPromise(setActiveOrganization(organization.id));
                activated = true;
                notifyAuthChange();
              } catch {
                // Creation succeeded even if activating the organization did not.
              }
              await refresh();
              if (activated) {
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
          {activeOrganization && canUpdateOrganization ? (
            <EditOrganizationSection
              baseUrl={baseUrl}
              editingLocale={editingOrganizationLocale}
              organization={activeOrganization}
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
          {activeOrganization ? (
            <OrganizationMembersManager
              baseUrl={baseUrl}
              canManageMembers={canManageApiKeys}
              organization={activeOrganization}
              currentUserId={session.user.id}
              active={dialog === "members"}
              onLeft={async () => {
                setDialog(null);
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
          {activeOrganization ? (
            <OrganizationApiKeyManager
              baseUrl={baseUrl}
              organization={activeOrganization}
              active={dialog === "apiKeys" && canManageApiKeys}
              permissionLabels={auth?.accessLabels ?? undefined}
              permissions={
                apiKeyPermissions ??
                auth?.access?.apiKeyPermissions.organization ??
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
        <DialogContent className="max-h-[85vh] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-4xl">
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
            baseUrl={baseUrl}
            invitations={userInvitations}
            loading={loadingUserInvitations}
            error={userInvitationsError}
            {...(activeOrganization
              ? { activeOrganizationId: activeOrganization.id }
              : {})}
            onActionComplete={refreshAfterInvitationAction}
          />
        </DialogContent>
      </Dialog>
    </OrganizationMessagesContext.Provider>
  );
}

function UserInvitationsManager({
  baseUrl,
  invitations,
  loading,
  error,
  activeOrganizationId,
  onActionComplete,
}: {
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

    try {
      await Effect.runPromise(
        authHttpClient(baseUrl).pipe(
          Effect.flatMap((client) =>
            client.auth.organizationAcceptInvitation({
              payload: { invitationId: invitation.id },
            }),
          ),
        ),
      );
      notifyAuthChange();
      await onActionComplete(activeOrganizationId);
    } catch (cause) {
      setActionError(
        organizationFailureMessage(
          cause,
          m.organization_invitation_accept_error(),
        ),
      );
    } finally {
      setActingInvitationId(null);
    }
  };

  const rejectInvitation = async (invitation: UserInvitationSummary) => {
    setActingInvitationId(invitation.id);
    setActionError(null);

    try {
      await Effect.runPromise(
        authHttpClient(baseUrl).pipe(
          Effect.flatMap((client) =>
            client.auth.organizationRejectInvitation({
              payload: { invitationId: invitation.id },
            }),
          ),
        ),
      );
      await onActionComplete(activeOrganizationId);
    } catch (cause) {
      setActionError(
        organizationFailureMessage(
          cause,
          m.organization_invitation_reject_error(),
        ),
      );
    } finally {
      setActingInvitationId(null);
    }
  };

  return (
    <section className="flex min-w-0 flex-col gap-4">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {actionError ? (
        <p className="text-destructive text-sm">{actionError}</p>
      ) : null}
      <div className="-m-1 min-w-0 overflow-x-auto p-1">
        <DataTable
          columnDefs={userInvitationColumns({
            baseUrl,
            m,
            now: invitationNow,
          })}
          rowData={invitations}
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
          status={{
            empty: loading
              ? m.user_loading()
              : m.organization_user_invitations_empty(),
            loading,
          }}
        />
      </div>
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
}): DataTableColDef<UserInvitationSummary>[] => [
  {
    field: "organizationName",
    headerName: m.organization_invitation_organization(),
    cellRenderer: ({ data }) => (
      <InvitationOrganizationBrand baseUrl={baseUrl} invitation={data} />
    ),
  },
  {
    field: "role",
    headerName: m.organization_member_role(),
    cellRenderer: ({ data }) => (
      <Badge variant="secondary">{organizationRoleLabel(data.role, m)}</Badge>
    ),
  },
  {
    field: "status",
    headerName: m.organization_invitation_status(),
    cellRenderer: ({ data }) => (
      <Badge
        variant={isInvitationExpired(data, now) ? "destructive" : "default"}
      >
        {invitationStatusLabel(invitationDisplayStatus(data, now), m)}
      </Badge>
    ),
  },
  {
    field: "expiresAt",
    headerName: m.organization_invitation_expires(),
    cellRenderer: ({ data }) => (
      <span className="text-muted-foreground text-sm">
        {formatOrganizationDate(data.expiresAt)}
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
    invitationOrganizationProfileAtom(baseUrl)(invitation.organizationId)(
      locale,
    ),
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
  baseUrl,
  editingLocale,
  organization,
  onUpdated,
}: {
  baseUrl?: string | undefined;
  editingLocale: OrganizationLocale;
  organization: OrganizationSummary;
  onUpdated: () => Promise<void>;
}) {
  const m = useOrganizationMessages();
  const [defaultLocale] = useState(currentOrganizationLocale);
  const defaultValues = organizationFormDefaults(organization, baseUrl);
  const [form] = useState(() =>
    FormReact.make(organizationFormBuilder, {
      runtime: authClientApi(baseUrl).runtime,
      fields: organizationFormFields,
      onSubmit: (_, { decoded: value }) =>
        Effect.gen(function* () {
          const name = organizationNameFromForm(value, defaultLocale);
          if (!name)
            return yield* Effect.fail(
              new Error(m.organization_name_required()),
            );

          const slug = value.slug.trim().toLowerCase();
          const client = yield* authHttpClient(baseUrl);
          const metadata = yield* organizationMetadataFromForm(
            value,
            m,
            (input) => client.authExtra.uploadUserImage(input),
            organization.metadata,
          );
          const normalizedMetadata =
            yield* normalizeOrganizationMetadata(metadata);
          const updated = yield* client.auth.organizationUpdate({
            payload: {
              organizationId: organization.id,
              data: {
                name,
                slug,
                metadata: normalizedMetadata,
              },
            },
          });
          yield* Effect.sync(notifyAuthChange);
          yield* Effect.tryPromise({
            try: onUpdated,
            catch: (cause) => cause,
          });
          return updated;
        }).pipe(
          Effect.mapError((cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.organization_update_error()),
          ),
        ),
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
              <form.emails
                locale={editingLocale}
                messages={organizationContactFieldMessages(m)}
              />
            </OrganizationContactGroup>
            <OrganizationContactGroup
              title={m.organization_contact_phone_type()}
            >
              <form.phones
                locale={editingLocale}
                messages={organizationContactFieldMessages(m)}
              />
            </OrganizationContactGroup>
            <OrganizationContactGroup
              title={m.organization_contact_website_type()}
            >
              <form.websites
                locale={editingLocale}
                messages={organizationContactFieldMessages(m)}
              />
            </OrganizationContactGroup>
            <OrganizationContactGroup
              title={m.organization_contact_social_type()}
            >
              <form.socials
                locale={editingLocale}
                messages={organizationContactFieldMessages(m)}
              />
            </OrganizationContactGroup>
          </OrganizationFormSection>
          <Separator className="my-2" />
          <OrganizationFormSection title={m.organization_address()}>
            <form.addresses
              locale={editingLocale}
              messages={organizationContactFieldMessages(m)}
            />
          </OrganizationFormSection>
          <SubmitError result={submitResult} />
          <SubmitButton form={form} />
        </form>
      </form.Initialize>
    </section>
  );
}

function CreateOrganizationSection({
  baseUrl,
  editingLocale,
  organizations,
  onCreated,
}: {
  baseUrl?: string | undefined;
  editingLocale: OrganizationLocale;
  organizations: readonly OrganizationSummary[];
  onCreated: (organization: OrganizationSummary) => Promise<void>;
}) {
  const m = useOrganizationMessages();
  const [defaultLocale] = useState(currentOrganizationLocale);
  const defaultValues = organizationFormDefaults(undefined, baseUrl);
  const [form] = useState(() =>
    FormReact.make(organizationFormBuilder, {
      runtime: authClientApi(baseUrl).runtime,
      fields: organizationFormFields,
      onSubmit: (_, { decoded: value }) =>
        Effect.gen(function* () {
          const name = organizationNameFromForm(value, defaultLocale);
          if (!name)
            return yield* Effect.fail(
              new Error(m.organization_name_required()),
            );

          const slug = (value.slug.trim() || slugify(name)).toLowerCase();
          const client = yield* authHttpClient(baseUrl);
          const metadata = yield* organizationMetadataFromForm(
            { ...value, slug },
            m,
            (input) => client.authExtra.uploadUserImage(input),
          );
          const normalizedMetadata =
            yield* normalizeOrganizationMetadata(metadata);
          const createPayload =
            value.parentId === noParentOrganization
              ? { name, slug, metadata: normalizedMetadata }
              : {
                  name,
                  slug,
                  metadata: normalizedMetadata,
                  parentId: value.parentId,
                };
          const created = yield* client.auth
            .organizationCreate({ payload: createPayload })
            .pipe(
              Effect.mapError(
                (cause) =>
                  new Error(
                    isOrganizationSlugConflict(cause)
                      ? m.organization_create_slug_conflict()
                      : organizationFailureMessage(
                          cause,
                          m.organization_create_error(),
                        ),
                  ),
              ),
            );
          yield* Effect.sync(notifyAuthChange);
          yield* Effect.tryPromise({
            try: () => onCreated(created),
            catch: (cause) => cause,
          });
          return created;
        }).pipe(
          Effect.mapError((cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.organization_create_error()),
          ),
        ),
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
              <form.emails
                locale={editingLocale}
                messages={organizationContactFieldMessages(m)}
              />
            </OrganizationContactGroup>
            <OrganizationContactGroup
              title={m.organization_contact_phone_type()}
            >
              <form.phones
                locale={editingLocale}
                messages={organizationContactFieldMessages(m)}
              />
            </OrganizationContactGroup>
            <OrganizationContactGroup
              title={m.organization_contact_website_type()}
            >
              <form.websites
                locale={editingLocale}
                messages={organizationContactFieldMessages(m)}
              />
            </OrganizationContactGroup>
            <OrganizationContactGroup
              title={m.organization_contact_social_type()}
            >
              <form.socials
                locale={editingLocale}
                messages={organizationContactFieldMessages(m)}
              />
            </OrganizationContactGroup>
          </OrganizationFormSection>
          <Separator className="my-2" />
          <OrganizationFormSection title={m.organization_address()}>
            <form.addresses
              locale={editingLocale}
              messages={organizationContactFieldMessages(m)}
            />
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
  baseUrl,
  canManageMembers,
  organization,
  currentUserId,
  active,
  onLeft,
}: {
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
    ? organizationMembersAtom(baseUrl)(organization.id)
    : emptyOrganizationMembersAtom;
  const invitationsAtom = hasOpened
    ? organizationInvitationsAtom(baseUrl)(organization.id)
    : emptyOrganizationInvitationsAtom;
  const membersResult = useAtomValue(membersAtom);
  const invitationsResult = useAtomValue(invitationsAtom);
  const refreshMembers = useAtomRefresh(membersAtom);
  const refreshInvitations = useAtomRefresh(invitationsAtom);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] = useState<
    string | null
  >(null);
  const [leavingOrganization, setLeavingOrganization] = useState(false);
  const [lastMembersData, setLastMembersData] =
    useState<OrganizationMembersData | null>(null);
  const currentMembers = AsyncResult.match(membersResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value.members,
  });
  const currentInvitations = AsyncResult.match(invitationsResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  });
  const currentMembersData =
    currentMembers && currentInvitations
      ? {
          members: Array.from(currentMembers),
          invitations: Array.from(currentInvitations).filter(
            (invitation) => invitation.status === "pending",
          ),
        }
      : null;
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
  const invitationsError = AsyncResult.match(invitationsResult, {
    onInitial: () => null,
    onFailure: () => m.organization_invitations_load_error(),
    onSuccess: () => null,
  });
  const loadError = membersError ?? invitationsError;
  const loading =
    !lastMembersData &&
    (membersResult._tag === "Initial" || invitationsResult._tag === "Initial");
  const canInviteMembers = canManageMembers;
  const canRemoveMembers = canManageMembers;
  useEffect(() => {
    if (!currentMembers || !currentInvitations) return;

    setLastMembersData({
      members: Array.from(currentMembers),
      invitations: Array.from(currentInvitations).filter(
        (invitation) => invitation.status === "pending",
      ),
    });
  }, [currentInvitations, currentMembers]);

  const [inviteForm] = useState(() =>
    FormReact.make(inviteMemberFormBuilder, {
      runtime: authClientApi(baseUrl).runtime,
      fields: {
        email: TextField,
        role: SelectField,
      },
      onSubmit: (_, { decoded: value }) =>
        authHttpClient(baseUrl).pipe(
          Effect.flatMap((client) =>
            client.auth.organizationInviteMember({
              payload: {
                email: value.email.trim(),
                role: normalizeInvitationRole(value.role),
                organizationId: organization.id,
              },
            }),
          ),
          Effect.tap(() => Effect.sync(refreshInvitations)),
          Effect.mapError((cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.organization_invite_error()),
          ),
        ),
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

    try {
      await Effect.runPromise(
        authHttpClient(baseUrl).pipe(
          Effect.flatMap((client) =>
            client.auth.organizationUpdateMemberRole({
              payload: {
                memberId: member.id,
                role: Array.isArray(role)
                  ? role
                  : normalizeOrganizationRole(role),
                organizationId: organization.id,
              },
            }),
          ),
        ),
      );
      refreshMembers();
    } catch (cause) {
      setMemberRoleOverrides((current) => ({
        ...current,
        [member.id]: member.role,
      }));
      setError(
        organizationFailureMessage(cause, m.organization_member_role_error()),
      );
    }
  };

  const removeMember = async (member: OrganizationMemberRow) => {
    setError(null);

    try {
      await Effect.runPromise(
        authHttpClient(baseUrl).pipe(
          Effect.flatMap((client) =>
            client.auth.organizationRemoveMember({
              payload: {
                memberIdOrEmail: member.id,
                organizationId: organization.id,
              },
            }),
          ),
        ),
      );
      refreshMembers();
    } catch (cause) {
      setError(
        organizationFailureMessage(cause, m.organization_member_remove_error()),
      );
    }
  };

  const leaveOrganization = async () => {
    setLeavingOrganization(true);
    setError(null);

    try {
      await Effect.runPromise(
        authHttpClient(baseUrl).pipe(
          Effect.flatMap((client) =>
            client.auth.organizationLeave({
              payload: { organizationId: organization.id },
            }),
          ),
        ),
      );
      notifyAuthChange();
      await onLeft();
    } catch (cause) {
      setError(
        organizationFailureMessage(cause, m.organization_member_leave_error()),
      );
    } finally {
      setLeavingOrganization(false);
    }
  };

  const cancelInvitation = async (
    invitation: OrganizationInvitationSummary,
  ) => {
    setCancellingInvitationId(invitation.id);
    setError(null);

    try {
      await Effect.runPromise(
        authHttpClient(baseUrl).pipe(
          Effect.flatMap((client) =>
            client.auth.organizationCancelInvitation({
              payload: { invitationId: invitation.id },
            }),
          ),
        ),
      );
      refreshInvitations();
    } catch (cause) {
      setError(
        organizationFailureMessage(
          cause,
          m.organization_invitation_cancel_error(),
        ),
      );
    } finally {
      setCancellingInvitationId(null);
    }
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
        {!inviting && loadError ? (
          <p className="text-destructive text-sm">{loadError}</p>
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
                columnDefs={memberColumns({
                  m,
                  baseUrl,
                  canChangeRoles: canManageMembers,
                  onRoleChange: updateRole,
                })}
                rowData={displayedMembers}
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
                status={{ empty: m.organization_members_empty(), loading }}
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
                columnDefs={invitationColumns({
                  m,
                  now: invitationNow,
                })}
                rowData={invitations}
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
                status={{ empty: m.organization_invitations_empty(), loading }}
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
}): DataTableColDef<OrganizationMemberRow>[] => [
  {
    colId: "user",
    headerName: m.organization_member_user(),
    cellRenderer: ({ data }) => {
      const image = assetUrl(data.user.image, baseUrl);

      return (
        <AppBrand
          to={null}
          label={data.user.name}
          subtitle={data.user.email}
          icon={UserIcon}
          className="min-w-0"
          {...(image ? { imageSrc: image } : {})}
        />
      );
    },
  },
  {
    field: "role",
    headerName: m.organization_member_role(),
    cellRenderer: ({ data }) => {
      const member = data;
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
    field: "createdAt",
    headerName: m.organization_member_joined(),
    cellRenderer: ({ data }) => (
      <span className="text-muted-foreground text-sm">
        {formatOrganizationDate(data.createdAt)}
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
}): DataTableColDef<OrganizationInvitationSummary>[] => [
  {
    field: "email",
    headerName: m.organization_member_email(),
    cellRenderer: ({ data }) => (
      <p className="truncate font-medium">{data.email}</p>
    ),
  },
  {
    field: "role",
    headerName: m.organization_member_role(),
    cellRenderer: ({ data }) => (
      <Badge variant="secondary">{organizationRoleLabel(data.role, m)}</Badge>
    ),
  },
  {
    field: "status",
    headerName: m.organization_invitation_status(),
    cellRenderer: ({ data }) => (
      <Badge
        variant={isInvitationExpired(data, now) ? "destructive" : "default"}
      >
        {invitationStatusLabel(invitationDisplayStatus(data, now), m)}
      </Badge>
    ),
  },
  {
    field: "expiresAt",
    headerName: m.organization_invitation_expires(),
    cellRenderer: ({ data }) => (
      <span className="text-muted-foreground text-sm">
        {formatOrganizationDate(data.expiresAt)}
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
  baseUrl,
  organization,
  active,
  permissionLabels,
  permissions,
}: {
  baseUrl?: string | undefined;
  organization: OrganizationSummary;
  active: boolean;
  permissionLabels?: ProjectAccessLabelCatalog | undefined;
  permissions: Readonly<Record<string, ReadonlyArray<string>>>;
}) {
  const m = useOrganizationMessages();
  const hasOpened = useOpenedOnce(active);
  const keysAtom = hasOpened
    ? organizationApiKeysAtom(baseUrl)(organization.id)
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
    onSuccess: ({ value }) => Array.from(value.apiKeys),
  });
  const keysError = AsyncResult.match(keysResult, {
    onInitial: () => null,
    onFailure: () => m.user_api_keys_load_error(),
    onSuccess: () => null,
  });
  const loading = keysResult._tag === "Initial";
  const [createForm] = useState(() =>
    FormReact.make(apiKeyFormBuilder, {
      runtime: authClientApi(baseUrl).runtime,
      fields: { name: TextField, referrers: TextAreaField },
      onSubmit: (_, { decoded: value }) =>
        Effect.gen(function* () {
          yield* Effect.sync(() => setCreatedKey(null));
          const client = yield* authHttpClient(baseUrl);
          const created = yield* client.authExtra.createApiKey({
            payload: {
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
          });

          yield* Effect.sync(() => {
            setCreatedKey(created.key);
            setSelectedPermissions({});
            refreshKeys();
          });
          return created;
        }).pipe(
          Effect.mapError((cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.user_api_key_create_error()),
          ),
        ),
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
    setError(null);
    try {
      await Effect.runPromise(
        authHttpClient(baseUrl).pipe(
          Effect.flatMap((client) =>
            client.auth.apiKeyDelete({
              payload: { configId: "organization", keyId: key.id },
            }),
          ),
        ),
      );
      refreshKeys();
    } catch (cause) {
      setError(
        organizationFailureMessage(cause, m.user_api_key_delete_error()),
      );
    }
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
                  clearAllLabel={m.user_api_key_permissions_clear_all()}
                  description={m.user_api_key_permissions_description()}
                  idPrefix="organization-create"
                  permissions={permissions}
                  labels={permissionLabels}
                  selectAllLabel={m.user_api_key_permissions_select_all()}
                  selected={selectedPermissions}
                  title={m.user_api_key_permissions()}
                  onChange={togglePermission}
                  onChangeAll={(ids, checked) =>
                    setSelectedPermissions((current) => ({
                      ...current,
                      ...Object.fromEntries(ids.map((id) => [id, checked])),
                    }))
                  }
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
              columnDefs={apiKeyColumns({ m })}
              rowData={keys}
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
              status={{
                empty: loading ? m.user_loading() : m.table_empty(),
                loading,
              }}
            />
          </div>
        ) : null}
        {editingKey ? (
          <OrganizationApiKeyEditForm
            baseUrl={baseUrl}
            key={editingKey.id}
            keyData={editingKey}
            permissions={permissions}
            permissionLabels={permissionLabels}
            messages={{
              clearAll: m.user_api_key_permissions_clear_all(),
              enabled: m.user_api_key_enabled(),
              name: m.user_api_key_name(),
              referrers: m.user_api_key_referrers(),
              referrersDescription: m.user_api_key_referrers_description(),
              referrersError: m.user_api_key_referrers_error(),
              referrersPlaceholder: m.user_api_key_referrers_placeholder(),
              permissions: m.user_api_key_permissions(),
              permissionsDescription: m.user_api_key_permissions_description(),
              selectAll: m.user_api_key_permissions_select_all(),
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

function OrganizationApiKeyEditForm({
  baseUrl,
  keyData,
  messages,
  permissions,
  permissionLabels,
  onSaved,
}: {
  baseUrl?: string | undefined;
  keyData: ApiKeySummary;
  messages: {
    clearAll: string;
    enabled: string;
    name: string;
    referrers: string;
    referrersDescription: string;
    referrersError: string;
    referrersPlaceholder: string;
    permissions: string;
    permissionsDescription: string;
    selectAll: string;
    updateError: string;
  };
  permissions: Readonly<Record<string, ReadonlyArray<string>>>;
  permissionLabels?: ProjectAccessLabelCatalog | undefined;
  onSaved: () => void;
}) {
  const permissionOptions = Object.entries(permissions).flatMap(
    ([project, actions]) =>
      actions.map((action) => ({
        id: `${project}:${action}`,
        project,
        action,
      })),
  );
  const currentPermissions = Schema.decodeUnknownOption(ExtraApiKeyPermissions)(
    keyData.permissions ?? {},
  );
  const currentGrant = Option.isSome(currentPermissions)
    ? currentPermissions.value
    : {};
  const initialSelectedPermissions = Object.fromEntries(
    permissionOptions.map((option) => [
      option.id,
      currentGrant[option.project]?.includes(option.action) ?? false,
    ]),
  );
  const permissionOptionsRef = useRef(permissionOptions);
  const permissionsRef = useRef(permissions);
  permissionOptionsRef.current = permissionOptions;
  permissionsRef.current = permissions;
  const [form] = useState(() =>
    FormReact.make(editApiKeyFormBuilder, {
      runtime: authClientApi(baseUrl).runtime,
      fields: {
        name: TextField,
        enabled: CheckboxField,
        referrers: TextAreaField,
        permissions: ApiKeyPermissionsField,
      },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded }) =>
        Effect.gen(function* () {
          const referrers = parseApiKeyReferrers(
            decoded.referrers,
            messages.referrersError,
          );
          const selectedGrant: Record<string, string[]> = {};
          for (const project of Object.keys(permissionsRef.current)) {
            selectedGrant[project] = [];
          }
          for (const option of permissionOptionsRef.current) {
            if (!decoded.permissions[option.id]) continue;
            selectedGrant[option.project] = [
              ...(selectedGrant[option.project] ?? []),
              option.action,
            ];
          }
          const client = yield* authHttpClient(baseUrl);
          const updated = yield* client.authExtra.updateApiKey({
            params: { keyId: keyData.id },
            payload: {
              configId: "organization",
              name: decoded.name.trim(),
              enabled: decoded.enabled,
              permissions: selectedGrant,
              referrers,
            },
          });
          yield* Effect.sync(onSaved);
          return updated;
        }).pipe(
          Effect.mapError((cause) =>
            cause instanceof Error
              ? cause
              : new Error(
                  organizationFailureMessage(cause, messages.updateError),
                ),
          ),
        ),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);

  return (
    <section className="w-full">
      <form.Initialize
        defaultValues={{
          name: keyData.name ?? "",
          enabled: keyData.enabled,
          referrers: apiKeyReferrers(keyData.metadata).join("\n"),
          permissions: initialSelectedPermissions,
        }}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            submit();
          }}
        >
          <form.name label={messages.name} required />
          <form.enabled label={messages.enabled} />
          <form.referrers
            label={messages.referrers}
            description={messages.referrersDescription}
            placeholder={messages.referrersPlaceholder}
            rows={3}
          />
          <form.permissions
            clearAllLabel={messages.clearAll}
            description={messages.permissionsDescription}
            idPrefix={`organization-edit-${keyData.id}`}
            labels={permissionLabels}
            permissions={permissions}
            selectAllLabel={messages.selectAll}
            title={messages.permissions}
          />
          <SubmitError result={submitResult} />
          <SubmitButton form={form} />
        </form>
      </form.Initialize>
    </section>
  );
}

const apiKeyColumns = ({
  m,
}: {
  m: ReturnType<typeof organizationMessageFns>;
}): DataTableColDef<ApiKeySummary>[] => [
  {
    field: "name",
    headerName: m.user_api_key_name(),
    cellRenderer: ({ data }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{data.name}</p>
        <p className="text-muted-foreground text-sm">
          {data.start
            ? m.user_api_key_starts_with({ start: data.start })
            : m.user_api_key_hidden()}
        </p>
      </div>
    ),
  },
  {
    field: "enabled",
    headerName: m.user_api_key_status(),
    cellRenderer: ({ data }) => (
      <Badge variant={data.enabled ? "default" : "secondary"}>
        {data.enabled ? m.user_api_key_enabled() : m.user_api_key_disabled()}
      </Badge>
    ),
  },
  {
    colId: "permissions",
    valueGetter: ({ data }) => data.permissions,
    headerName: m.user_api_key_permissions(),
    cellRenderer: ({ data }) => {
      const values = organizationApiKeyFormattedPermissions(data.permissions);
      return (
        <DataTableListSummary
          emptyLabel={m.user_api_key_no_permissions()}
          items={values}
          visibleCount={1}
        />
      );
    },
  },
  {
    colId: "referrers",
    valueGetter: ({ data }) => data.metadata,
    headerName: m.user_api_key_referrers_column(),
    cellRenderer: ({ data }) => (
      <ApiKeyReferrers
        metadata={data.metadata}
        unrestrictedLabel={m.user_api_key_referrers_any()}
      />
    ),
  },
  {
    colId: "rateLimit",
    valueGetter: ({ data }) => apiKeyUsagePercent(data),
    headerName: m.user_api_key_rate_limit(),
    cellRenderer: ({ data }) => (
      <ApiKeyRateLimit
        keyData={data}
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

const organizationApiKeyFormattedPermissions = (
  value: typeof Schema.Unknown.Type,
) => {
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
