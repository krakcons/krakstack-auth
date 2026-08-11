import type { ApiKey } from "@better-auth/api-key/client";
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  type UseNavigateResult,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import {
  ArrowLeft,
  Building2,
  KeyRound,
  Loader2,
  LogOutIcon,
  Pencil,
  Plus,
  ShieldCheck,
  StopCircle,
  Trash2,
  UserCircleIcon,
  Users,
  UserIcon,
} from "lucide-react";
import { QRCode } from "react-qr-code";
import {
  type ComponentProps,
  type ReactNode,
  createContext,
  useContext,
  useRef,
  useState,
} from "react";

import { DataTable } from "@krak-stack/registry/data-table";
import { AppBrand } from "@krak-stack/registry/app-brand";
import {
  effectFormMessages,
  ImageField,
  SubmitButton,
  SubmitError,
  TextAreaField,
  TextField,
} from "@krak-stack/registry/effect-form";
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

import type { AuthUiClient } from "./auth-client";
import { authClientApi } from "./auth-client-api";
import { useKrakstackAuth } from "./auth-provider";
import { createApiKey, parseApiKeyReferrers } from "./api-key";
import { ApiKeyEditForm } from "./api-key-edit-form";
import { ApiKeyPermissions } from "./api-key-permissions";
import { ApiKeyRateLimit, apiKeyUsagePercent } from "./api-key-rate-limit";
import { ApiKeyReferrers } from "./api-key-referrers";
import { useOpenedOnce } from "./hooks";
import { ExtraUploadedAsset } from "../extra/schema";
import { assetPath, assetUrl } from "./utils";
import { AdminOrganizationsTable } from "./admin-organizations";
import { AdminUsersTable } from "./admin-users";
import type { ProjectAccessLabelCatalog } from "../access";

const messages = {
  en: {
    table_empty: "No results.",
    user_account_cancel: "Cancel",
    user_account_confirm_revoke: "Revoke account",
    user_account_connected: "Connected",
    user_account_current_password: "Current password",
    user_account_google_connect: "Connect Google",
    user_account_google_description:
      "Use your Google account as a sign-in option.",
    user_account_google_link_error: "Could not connect Google.",
    user_account_google_title: "Google",
    user_account_new_password: "New password",
    user_account_not_connected: "Not connected",
    user_account_only_method: "Only sign-in method",
    user_account_password_change_description:
      "Update the password used to sign in with your email.",
    user_account_password_change_error: "Could not change your password.",
    user_account_password_change_submit: "Change password",
    user_account_password_change_success: "Your password has been updated.",
    user_account_password_change_title: "Change password",
    user_account_password_connected_description:
      "Password sign-in is enabled for this account.",
    user_account_password_description:
      "Use an email and password as a sign-in option.",
    user_account_password_set: "Set password",
    user_account_password_set_error: "Could not set your password.",
    user_account_password_title: "Password",
    user_account_password_verify_error: "Could not verify your password.",
    user_account_revoke: "Revoke",
    user_account_revoke_description:
      "Revoke {provider} from this account. You will not be able to use it to sign in unless you connect it again.",
    user_account_revoke_error: "Could not revoke this account.",
    user_accounts_description:
      "Connect external sign-in providers to this account.",
    user_accounts_load_error: "Could not load connected accounts.",
    user_accounts_title: "Accounts",
    user_api_key_copied: "Copied",
    user_api_key_copy: "Copy",
    user_api_key_back: "Back",
    user_api_key_create_description:
      "Configure a new API key for your user account.",
    user_api_key_create_error: "Could not create the API key.",
    user_api_key_create_title: "Create API key",
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
      "Choose the permissions this API key should receive.",
    user_api_key_rate_limit: "Rate limit",
    user_api_key_referrers: "Allowed referrers (optional)",
    user_api_key_referrers_any: "Any referrer",
    user_api_key_referrers_column: "Referrers",
    user_api_key_referrers_description:
      "Enter any number of URLs, separated by commas or new lines. Leave empty to allow any referrer.",
    user_api_key_referrers_error: "{referrer} is not a valid HTTP(S) URL.",
    user_api_key_referrers_placeholder:
      "https://app.example.com\nhttps://admin.example.com",
    user_api_key_status: "Status",
    user_api_key_unlimited: "Unlimited",
    user_api_key_update_error: "Could not update the API key.",
    user_api_key_usage: "API key usage",
    user_api_key_window_days: "{count}d",
    user_api_key_window_hours: "{count}h",
    user_api_key_window_minutes: "{count}m",
    user_api_key_window_none: "None",
    user_api_key_window_seconds: "{count}s",
    user_api_keys_description:
      "Create and manage API keys for your user account.",
    user_api_keys_export_file_name: "api-keys.csv",
    user_api_keys_load_error: "Could not load API keys.",
    user_api_keys_title: "API keys",
    user_button_account: "Account",
    user_button_admin_organizations: "Organizations",
    user_button_admin_organizations_description:
      "Review and manage organizations.",
    user_button_admin_users: "Users",
    user_button_admin_users_description: "Review and manage users.",
    user_button_api_keys: "API keys",
    user_button_aria_label: "Open user menu",
    user_button_impersonating: "Impersonating",
    user_button_logout: "Log out",
    user_button_security: "Security",
    user_button_stop_impersonating: "Stop impersonating",
    user_delete: "Delete",
    user_field_password: "Password",
    user_form_description:
      "Update the profile details associated with your account.",
    user_form_name_label: "Name",
    user_form_title: "Account",
    user_form_update_error: "Unable to update your account.",
    user_loading: "Loading...",
    user_profile_description: "Update your public profile details.",
    user_profile_image_upload_error: "Could not upload your profile photo.",
    user_profile_photo_upload_label: "Profile photo",
    user_profile_title: "Profile",
    user_security_description:
      "Protect your account with authenticator app verification.",
    user_security_title: "Security",
    user_two_factor_backup_codes_warning:
      "Save these backup codes now. They are shown only during setup.",
    user_two_factor_code: "Authentication code",
    user_two_factor_description:
      "Use a time-based one-time password from your authenticator app.",
    user_two_factor_disable_error:
      "Could not disable two-factor authentication.",
    user_two_factor_disabled: "Disabled",
    user_two_factor_disabled_message: "Two-factor authentication is disabled.",
    user_two_factor_enable_error: "Could not start two-factor setup.",
    user_two_factor_enable_submit: "Enable",
    user_two_factor_enabled: "Enabled",
    user_two_factor_enabled_message: "Two-factor authentication is enabled.",
    user_two_factor_scan_description:
      "Add this account to your authenticator app, then enter the generated code below.",
    user_two_factor_scan_title: "Scan this QR code",
    user_two_factor_title: "Two-factor authentication",
    user_two_factor_verify_error: "Could not verify the code.",
  },
  fr: {
    table_empty: "Aucun résultat.",
    user_account_cancel: "Annuler",
    user_account_confirm_revoke: "Révoquer le compte",
    user_account_connected: "Connecté",
    user_account_current_password: "Mot de passe actuel",
    user_account_google_connect: "Connecter Google",
    user_account_google_description:
      "Utilisez votre compte Google comme option de connexion.",
    user_account_google_link_error: "Impossible de connecter Google.",
    user_account_google_title: "Google",
    user_account_new_password: "Nouveau mot de passe",
    user_account_not_connected: "Non connecté",
    user_account_only_method: "Seule méthode de connexion",
    user_account_password_change_description:
      "Mettez à jour le mot de passe utilisé pour vous connecter avec votre courriel.",
    user_account_password_change_error:
      "Impossible de modifier votre mot de passe.",
    user_account_password_change_submit: "Modifier le mot de passe",
    user_account_password_change_success:
      "Votre mot de passe a été mis à jour.",
    user_account_password_change_title: "Modifier le mot de passe",
    user_account_password_connected_description:
      "La connexion par mot de passe est activée pour ce compte.",
    user_account_password_description:
      "Utilisez un courriel et un mot de passe comme option de connexion.",
    user_account_password_set: "Définir le mot de passe",
    user_account_password_set_error:
      "Impossible de définir votre mot de passe.",
    user_account_password_title: "Mot de passe",
    user_account_password_verify_error:
      "Impossible de vérifier votre mot de passe.",
    user_account_revoke: "Révoquer",
    user_account_revoke_description:
      "Révoquez {provider} de ce compte. Vous ne pourrez plus l'utiliser pour vous connecter, sauf si vous le reconnectez.",
    user_account_revoke_error: "Impossible de révoquer ce compte.",
    user_accounts_description:
      "Connectez des fournisseurs de connexion externes à ce compte.",
    user_accounts_load_error: "Impossible de charger les comptes connectés.",
    user_accounts_title: "Comptes",
    user_api_key_copied: "Copié",
    user_api_key_copy: "Copier",
    user_api_key_back: "Retour",
    user_api_key_create_description:
      "Configurez une nouvelle clé API pour votre compte utilisateur.",
    user_api_key_create_error: "Impossible de créer la clé API.",
    user_api_key_create_title: "Créer une clé API",
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
      "Choisissez les autorisations que cette clé API doit recevoir.",
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
    user_api_key_status: "Statut",
    user_api_key_unlimited: "Illimitée",
    user_api_key_update_error: "Impossible de mettre à jour la clé API.",
    user_api_key_usage: "Utilisation de la clé API",
    user_api_key_window_days: "{count} j",
    user_api_key_window_hours: "{count} h",
    user_api_key_window_minutes: "{count} min",
    user_api_key_window_none: "Aucune",
    user_api_key_window_seconds: "{count} s",
    user_api_keys_description:
      "Créez et gérez des clés API pour votre compte utilisateur.",
    user_api_keys_export_file_name: "cles-api.csv",
    user_api_keys_load_error: "Impossible de charger les clés API.",
    user_api_keys_title: "Clés API",
    user_button_account: "Compte",
    user_button_admin_organizations: "Organisations",
    user_button_admin_organizations_description:
      "Consultez et gérez les organisations.",
    user_button_admin_users: "Utilisateurs",
    user_button_admin_users_description: "Consultez et gérez les utilisateurs.",
    user_button_api_keys: "Clés API",
    user_button_aria_label: "Ouvrir le menu utilisateur",
    user_button_impersonating: "Imitation",
    user_button_logout: "Se déconnecter",
    user_button_security: "Sécurité",
    user_button_stop_impersonating: "Arrêter l'imitation",
    user_delete: "Supprimer",
    user_field_password: "Mot de passe",
    user_form_description:
      "Mettez à jour les informations de profil associées à votre compte.",
    user_form_name_label: "Nom",
    user_form_title: "Compte",
    user_form_update_error: "Impossible de mettre à jour votre compte.",
    user_loading: "Chargement...",
    user_profile_description:
      "Mettez à jour les informations de votre profil public.",
    user_profile_image_upload_error:
      "Impossible de téléverser votre photo de profil.",
    user_profile_photo_upload_label: "Photo de profil",
    user_profile_title: "Profil",
    user_security_description:
      "Protégez votre compte avec une vérification par application d'authentification.",
    user_security_title: "Sécurité",
    user_two_factor_backup_codes_warning:
      "Enregistrez ces codes de secours maintenant. Ils ne sont affichés que pendant la configuration.",
    user_two_factor_code: "Code d'authentification",
    user_two_factor_description:
      "Utilisez un mot de passe à usage unique généré par votre application d'authentification.",
    user_two_factor_disable_error:
      "Impossible de désactiver l'authentification à deux facteurs.",
    user_two_factor_disabled: "Désactivée",
    user_two_factor_disabled_message:
      "L'authentification à deux facteurs est désactivée.",
    user_two_factor_enable_error:
      "Impossible de démarrer la configuration à deux facteurs.",
    user_two_factor_enable_submit: "Activer",
    user_two_factor_enabled: "Activée",
    user_two_factor_enabled_message:
      "L'authentification à deux facteurs est activée.",
    user_two_factor_scan_description:
      "Ajoutez ce compte à votre application d'authentification, puis saisissez le code généré ci-dessous.",
    user_two_factor_scan_title: "Scannez ce code QR",
    user_two_factor_title: "Authentification à deux facteurs",
    user_two_factor_verify_error: "Impossible de vérifier le code.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

type Locale = "en" | "fr";
type UserButtonMessageKey = keyof (typeof messages)["en"];
export type UserButtonMessages = Partial<Record<UserButtonMessageKey, string>>;

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

const userButtonMessages = (overrides?: UserButtonMessages) => ({
  ...(getLocale().startsWith("fr") ? messages.fr : messages.en),
  ...overrides,
});

type UserButtonLabels = ReturnType<typeof userButtonMessages>;

const interpolate = (value: string, params?: Record<string, string | number>) =>
  params
    ? value.replace(/\{([^}]+)\}/g, (_, key: string) =>
        String(params[key] ?? `{${key}}`),
      )
    : value;

const userButtonMessageFns = (labels: UserButtonLabels) =>
  new Proxy(
    {},
    {
      get:
        (_target, key: string) => (params?: Record<string, string | number>) =>
          interpolate(labels[key as UserButtonMessageKey], params),
    },
  ) as Record<
    UserButtonMessageKey,
    (params?: Record<string, string | number>) => string
  >;

const UserButtonMessagesContext = createContext(
  userButtonMessageFns(userButtonMessages()),
);
const useUserButtonMessages = () => useContext(UserButtonMessagesContext);

const hasRole = (role: unknown, roles: readonly string[]) =>
  typeof role === "string" &&
  role.split(",").some((item) => roles.includes(item.trim().toLowerCase()));

const hasAdminRole = (user: unknown) =>
  typeof user === "object" &&
  user !== null &&
  "role" in user &&
  hasRole(user.role, ["admin"]);

type UserFormType = {
  name: string;
  image: File | string | null;
};

const changePasswordFormBuilder = FormBuilder.empty
  .addField("currentPassword", Schema.NonEmptyString)
  .addField("newPassword", Schema.NonEmptyString);

const passwordFormBuilder = (required: boolean) =>
  FormBuilder.empty.addField(
    "password",
    required ? Schema.NonEmptyString : Schema.String,
  );

const userFormBuilder = FormBuilder.empty
  .addField("name", Schema.NonEmptyString)
  .addField(
    "image",
    Schema.UndefinedOr(
      Schema.NullOr(Schema.Union([Schema.String, Schema.instanceOf(File)])),
    ),
  );

const totpCodeFormBuilder = FormBuilder.empty.addField(
  "code",
  Schema.NonEmptyString,
);

const apiKeyFormBuilder = FormBuilder.empty
  .addField("name", Schema.NonEmptyString)
  .addField("referrers", Schema.String);

const isFile = (value: unknown): value is File => value instanceof File;

const decodeUploadedAsset = Schema.decodeUnknownPromise(ExtraUploadedAsset);

const uploadUserImageAsset = async (
  file: File,
  m: ReturnType<typeof userButtonMessageFns>,
  uploadUserImage: (input: { payload: FormData }) => Promise<unknown>,
) => {
  const payload = new FormData();
  payload.append("file", file);

  try {
    return await decodeUploadedAsset(await uploadUserImage({ payload }));
  } catch {
    throw new Error(m.user_profile_image_upload_error());
  }
};

type TotpSetup = {
  totpURI: string;
  backupCodes: string[];
};

type ApiKeySummary = Omit<ApiKey, "key">;

type LinkedAccount = {
  id: string;
  providerId: string;
  accountId: string;
};

type AccountCache = {
  accounts: LinkedAccount[] | null;
  error: string | null;
  reload: () => Promise<void>;
};

const requiresPasswordForAccountRevoke = (accounts: readonly LinkedAccount[]) =>
  accounts.some((account) => account.providerId === "credential");

const userAccountsAtom = Atom.family((authClient: AuthUiClient) =>
  Atom.keepAlive(
    Atom.make(
      Effect.tryPromise({
        try: async (): Promise<LinkedAccount[]> => {
          const result = await authClient.listAccounts();

          if (result.error) {
            throw new Error(result.error.message ?? "Could not load accounts.");
          }

          return result.data ?? [];
        },
        catch: (error) => error,
      }),
    ),
  ),
);

const emptyAccountsAtom = Atom.make(Effect.succeed([] as LinkedAccount[]));

const userApiKeysAtom = Atom.family((authClient: AuthUiClient) =>
  Atom.keepAlive(
    Atom.make(
      Effect.tryPromise({
        try: async (): Promise<ApiKeySummary[]> => {
          const result = await authClient.apiKey.list({
            query: { configId: "user" },
          });

          if (result.error) {
            throw new Error(result.error.message ?? "Could not load API keys.");
          }

          return result.data?.apiKeys ?? [];
        },
        catch: (error) => error,
      }),
    ),
  ),
);

const emptyApiKeysAtom = Atom.make(Effect.succeed([] as ApiKeySummary[]));

export type UserButtonProps = {
  authClient?: AuthUiClient;
  baseUrl?: string | undefined;
  signOutRedirect?: string;
  side?: ComponentProps<typeof DropdownMenuContent>["side"];
  defaultDialog?: UserButtonDialog | null;
  hideTrigger?: boolean;
  renderUnauthenticated?: () => ReactNode;
  menuActions?: ReactNode;
  apiKeyPermissions?: Readonly<Record<string, ReadonlyArray<string>>>;
  messages?: UserButtonMessages;
  dialog?: UserButtonDialog | null;
  onDialogChange?: (dialog: UserButtonDialog | null) => void;
};

export type UserButtonDialog =
  | "account"
  | "security"
  | "apiKeys"
  | "adminUsers"
  | "adminOrganizations";

export const UserButton = ({
  authClient: providedAuthClient,
  baseUrl,
  signOutRedirect = "/",
  side = "bottom",
  defaultDialog = null,
  hideTrigger = false,
  renderUnauthenticated,
  menuActions,
  apiKeyPermissions,
  messages,
  dialog: controlledDialog,
  onDialogChange,
}: UserButtonProps) => {
  const auth = useKrakstackAuth();
  const authClient = providedAuthClient ?? auth?.authClient;

  if (!authClient) {
    throw new Error("KrakstackAuthProvider is required to use authClient.");
  }

  const labels = userButtonMessages(messages);
  const m = userButtonMessageFns(labels);
  const projectConfig = auth?.projectConfig ?? null;
  const navigate = useNavigate();
  const currentSiteHref = useRouterState({
    select: (state) => `${import.meta.env.VITE_SITE_URL}${state.location.href}`,
  });
  const { data: session, isPending, refetch } = authClient.useSession();
  const [uncontrolledDialog, setUncontrolledDialog] =
    useState<UserButtonDialog | null>(defaultDialog);
  const [isStoppingImpersonation, setIsStoppingImpersonation] = useState(false);
  const settingsDialog =
    controlledDialog !== undefined ? controlledDialog : uncontrolledDialog;
  const [formError, setFormError] = useState<string | null>(null);
  const shouldLoadAccounts =
    Boolean(session) &&
    (settingsDialog === "account" || settingsDialog === "security");
  const accountsAtom = shouldLoadAccounts
    ? userAccountsAtom(authClient)
    : emptyAccountsAtom;
  const accountsResult = useAtomValue(accountsAtom);
  const refreshAccounts = useAtomRefresh(accountsAtom);
  const uploadUserImage = useAtomSet(
    authClientApi(baseUrl).mutation("authExtra", "uploadUserImage"),
    { mode: "promise" },
  );

  const accountCache: AccountCache = {
    accounts: AsyncResult.match(accountsResult, {
      onInitial: () => null,
      onFailure: () => null,
      onSuccess: ({ value }) => Array.from(value),
    }),
    error: AsyncResult.match(accountsResult, {
      onInitial: () => null,
      onFailure: () => m.user_accounts_load_error(),
      onSuccess: () => null,
    }),
    reload: async () => refreshAccounts(),
  };

  const setSettingsDialog = (
    next:
      | UserButtonDialog
      | null
      | ((current: UserButtonDialog | null) => UserButtonDialog | null),
  ) => {
    const nextDialog = typeof next === "function" ? next(settingsDialog) : next;

    if (nextDialog === settingsDialog) return;
    if (controlledDialog === undefined) setUncontrolledDialog(nextDialog);
    onDialogChange?.(nextDialog);
  };

  if (!session) {
    return <>{renderUnauthenticated?.()}</>;
  }

  const displayName = session.user.name.trim();
  const displayEmail = session.user.email.trim();
  const displayImage = assetUrl(session.user.image, baseUrl);
  const isImpersonating = Boolean(session.session.impersonatedBy);
  const isOrganizationImpersonating = Boolean(
    session.session.impersonatedByOrganizationId,
  );
  const canManageUserSettings = !isOrganizationImpersonating;
  const canUseAdminSettings = !isOrganizationImpersonating;
  const isAdmin = hasAdminRole(session.user);

  const signOut = async () => {
    const redirectUrl = signOutRedirect.startsWith("http")
      ? signOutRedirect
      : `${import.meta.env.VITE_SITE_URL}${signOutRedirect.startsWith("/") ? signOutRedirect : `/${signOutRedirect}`}`;

    await authClient.signOut();
    await navigate({ href: redirectUrl });
  };

  const stopImpersonating = async () => {
    setIsStoppingImpersonation(true);

    try {
      await authClient.admin.stopImpersonating();
      await refetch();
      await navigate({ href: currentSiteHref });
    } finally {
      setIsStoppingImpersonation(false);
    }
  };

  const updateUser = async (values: UserFormType) => {
    setFormError(null);
    const imageFile = isFile(values.image) ? values.image : null;
    const image = imageFile
      ? await (async () => {
          const uploaded = await uploadUserImageAsset(
            imageFile,
            m,
            uploadUserImage,
          );

          return assetPath(uploaded.url);
        })()
      : typeof values.image === "string"
        ? assetPath(values.image)
        : null;
    const result = await authClient.updateUser({
      name: values.name.trim(),
      image: image?.trim() ?? "",
    });

    if (isAuthErrorResult(result)) {
      throw new Error(result.error.message || m.user_form_update_error());
    }

    await refetch();

    setSettingsDialog(null);
  };

  return (
    <UserButtonMessagesContext.Provider value={m}>
      {hideTrigger ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon">
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={displayName || displayEmail}
                    className="size-full rounded-md object-cover"
                  />
                ) : (
                  <UserIcon className="size-4.5" />
                )}
                <span className="sr-only">{m.user_button_aria_label()}</span>
              </Button>
            }
          />
          <DropdownMenuContent
            className="w-56 rounded-lg"
            side={side}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              {isImpersonating ? (
                <div className="px-1 py-0.5">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {m.user_button_impersonating()}
                  </Badge>
                </div>
              ) : null}
              <DropdownMenuLabel className="p-0 font-normal">
                <AppBrand
                  to={null}
                  label={displayName || displayEmail}
                  subtitle={
                    displayName ? displayEmail : m.user_button_account()
                  }
                  icon={UserIcon}
                  className="px-1 py-1.5 text-left text-sm"
                  {...(displayImage ? { imageSrc: displayImage } : {})}
                />
              </DropdownMenuLabel>
              {menuActions ? (
                <>
                  <DropdownMenuSeparator />
                  {menuActions}
                </>
              ) : null}
              <DropdownMenuSeparator />
              {canManageUserSettings ? (
                <>
                  <DropdownMenuItem
                    disabled={isPending}
                    onClick={() => setSettingsDialog("account")}
                  >
                    <UserCircleIcon />
                    {m.user_button_account()}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSettingsDialog("security")}
                  >
                    <ShieldCheck />
                    {m.user_button_security()}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSettingsDialog("apiKeys")}
                  >
                    <KeyRound />
                    {m.user_button_api_keys()}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              {(isAdmin && canUseAdminSettings) || isImpersonating ? (
                <>
                  {isAdmin && canUseAdminSettings ? (
                    <>
                      <DropdownMenuItem
                        onClick={() => setSettingsDialog("adminUsers")}
                      >
                        <Users />
                        {m.user_button_admin_users()}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setSettingsDialog("adminOrganizations")}
                      >
                        <Building2 />
                        {m.user_button_admin_organizations()}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  {isImpersonating ? (
                    <DropdownMenuItem
                      disabled={isStoppingImpersonation}
                      onClick={stopImpersonating}
                    >
                      <StopCircle />
                      {m.user_button_stop_impersonating()}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem onClick={signOut}>
                <LogOutIcon />
                {m.user_button_logout()}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Dialog
        open={canManageUserSettings && settingsDialog === "account"}
        onOpenChange={(open) => {
          setSettingsDialog((current) =>
            open ? "account" : current === "account" ? null : current,
          );
        }}
      >
        <DialogContent className="max-h-[85vh] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {m.user_form_title()}
            </DialogTitle>
            <DialogDescription>{m.user_form_description()}</DialogDescription>
          </DialogHeader>
          <Separator />
          {isPending ? (
            <p className="text-muted-foreground text-sm">{m.user_loading()}</p>
          ) : (
            <div className="flex flex-col gap-6">
              <UserForm
                defaultValues={{
                  name: displayName ?? "",
                  image: displayImage || null,
                }}
                error={formError}
                onSubmit={async (data) => {
                  try {
                    await updateUser(data);
                  } catch (error) {
                    setFormError(
                      error instanceof Error
                        ? error.message
                        : m.user_form_update_error(),
                    );
                  }
                }}
              />
              <Separator />
              <ConnectedAccounts
                authClient={authClient}
                baseUrl={baseUrl}
                accountCache={accountCache}
                googleEnabled={projectConfig?.authOptions.google ?? true}
                currentSiteHref={currentSiteHref}
                navigate={navigate}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={canManageUserSettings && settingsDialog === "security"}
        onOpenChange={(open) => {
          setSettingsDialog((current) =>
            open ? "security" : current === "security" ? null : current,
          );
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {m.user_security_title()}
            </DialogTitle>
            <DialogDescription>
              {m.user_security_description()}
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="flex flex-col gap-6">
            <PasswordSettings
              authClient={authClient}
              baseUrl={baseUrl}
              accountCache={accountCache}
            />
            <Separator />
            <AccountSecuritySettings
              authClient={authClient}
              accountCache={accountCache}
            />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={canManageUserSettings && settingsDialog === "apiKeys"}
        onOpenChange={(open) => {
          setSettingsDialog((current) =>
            open ? "apiKeys" : current === "apiKeys" ? null : current,
          );
        }}
      >
        <DialogContent className="max-h-[85vh] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-3xl">
          <ApiKeyManager
            authClient={authClient}
            active={settingsDialog === "apiKeys"}
            permissionLabels={auth?.accessLabels ?? undefined}
            permissions={
              apiKeyPermissions ?? auth?.access?.apiKeyPermissions.user ?? {}
            }
          />
        </DialogContent>
      </Dialog>
      {isAdmin ? (
        <>
          <Dialog
            open={settingsDialog === "adminUsers"}
            onOpenChange={(open) => {
              setSettingsDialog((current) =>
                open ? "adminUsers" : current === "adminUsers" ? null : current,
              );
            }}
          >
            <DialogContent className="flex h-[85vh] flex-col overflow-y-auto sm:max-w-6xl">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {m.user_button_admin_users()}
                </DialogTitle>
                <DialogDescription>
                  {m.user_button_admin_users_description()}
                </DialogDescription>
              </DialogHeader>
              <Separator />
              <div className="min-h-0 flex-1">
                <AdminUsersTable />
              </div>
            </DialogContent>
          </Dialog>
          <Dialog
            open={settingsDialog === "adminOrganizations"}
            onOpenChange={(open) => {
              setSettingsDialog((current) =>
                open
                  ? "adminOrganizations"
                  : current === "adminOrganizations"
                    ? null
                    : current,
              );
            }}
          >
            <DialogContent className="flex h-[85vh] flex-col overflow-y-auto sm:max-w-6xl">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {m.user_button_admin_organizations()}
                </DialogTitle>
                <DialogDescription>
                  {m.user_button_admin_organizations_description()}
                </DialogDescription>
              </DialogHeader>
              <Separator />
              <div className="min-h-0 flex-1">
                <AdminOrganizationsTable />
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </UserButtonMessagesContext.Provider>
  );
};

function ConnectedAccounts({
  authClient,
  baseUrl,
  accountCache,
  googleEnabled,
  currentSiteHref,
  navigate,
}: {
  authClient: AuthUiClient;
  baseUrl?: string | undefined;
  accountCache: AccountCache;
  googleEnabled: boolean;
  currentSiteHref: string;
  navigate: UseNavigateResult<string>;
}) {
  const m = useUserButtonMessages();
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [revokingAccount, setRevokingAccount] = useState<LinkedAccount | null>(
    null,
  );
  const accounts = accountCache.accounts ?? [];

  const googleAccount = accounts.find(
    (account) => account.providerId === "google",
  );
  const requirePassword = requiresPasswordForAccountRevoke(accounts);
  const showGoogleAccount = googleEnabled || Boolean(googleAccount);

  if (accountCache.accounts && (accounts.length === 0 || !showGoogleAccount)) {
    return null;
  }

  const linkGoogle = async () => {
    if (!googleEnabled) return;

    setError(null);
    setIsLinking(true);

    const result = await authClient.linkSocial({
      provider: "google",
      callbackURL: currentSiteHref,
    });

    if (result.error) {
      setError(result.error.message ?? m.user_account_google_link_error());
      setIsLinking(false);
      return;
    }

    if (result.data?.url) {
      await navigate({ href: result.data.url });
      return;
    }

    setIsLinking(false);
  };

  const revokeAccount = async (account: LinkedAccount) => {
    setError(null);
    const result = await authClient.unlinkAccount({
      providerId: account.providerId,
      accountId: account.accountId,
    });

    if (result.error) {
      setError(result.error.message ?? m.user_account_revoke_error());
      return;
    }

    setRevokingAccount(null);
    await accountCache.reload();
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-sm leading-none font-medium">
          {m.user_accounts_title()}
        </h2>
        <p className="text-muted-foreground text-sm">
          {m.user_accounts_description()}
        </p>
      </div>
      {accountCache.accounts ? (
        <>
          {showGoogleAccount ? (
            <AccountProviderRow
              icon={<GoogleLogo />}
              title={m.user_account_google_title()}
              description={m.user_account_google_description()}
              account={googleAccount}
              connected={Boolean(googleAccount)}
              connectLabel={m.user_account_google_connect()}
              revokeLabel={m.user_account_revoke()}
              isConnecting={isLinking}
              renderDisconnected={undefined}
              onConnect={linkGoogle}
              onRevoke={(account) => setRevokingAccount(account)}
            />
          ) : null}
          {revokingAccount ? (
            <RevokeAccountForm
              baseUrl={baseUrl}
              account={revokingAccount}
              requirePassword={requirePassword}
              onCancel={() => setRevokingAccount(null)}
              onRevoke={revokeAccount}
            />
          ) : null}
        </>
      ) : !accountCache.error ? (
        <p className="text-muted-foreground text-sm">{m.user_loading()}</p>
      ) : null}
      {accountCache.error ? (
        <p className="text-destructive text-sm">{accountCache.error}</p>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </section>
  );
}

function AccountProviderRow({
  icon,
  title,
  description,
  account,
  connected,
  connectLabel,
  revokeLabel,
  isConnecting,
  renderDisconnected,
  onConnect,
  onRevoke,
}: {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  account: LinkedAccount | undefined;
  connected: boolean;
  connectLabel: ReactNode;
  revokeLabel: ReactNode;
  isConnecting?: boolean;
  renderDisconnected: ReactNode | undefined;
  onConnect: () => void;
  onRevoke: (account: LinkedAccount) => void;
}) {
  const m = useUserButtonMessages();
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-background flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{title}</p>
              <Badge variant={connected ? "default" : "secondary"}>
                {connected
                  ? m.user_account_connected()
                  : m.user_account_not_connected()}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>
        {connected && account ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => onRevoke(account)}
          >
            {revokeLabel}
          </Button>
        ) : renderDisconnected ? (
          renderDisconnected
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={isConnecting}
            onClick={onConnect}
          >
            {connectLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function PasswordSettings({
  authClient,
  baseUrl,
  accountCache,
}: {
  authClient: AuthUiClient;
  baseUrl?: string | undefined;
  accountCache: AccountCache;
}) {
  const [error, setError] = useState<string | null>(null);
  const [revokingAccount, setRevokingAccount] = useState<LinkedAccount | null>(
    null,
  );
  const m = useUserButtonMessages();
  const accounts = accountCache.accounts ?? [];

  const passwordAccount = accounts.find(
    (account) => account.providerId === "credential",
  );
  const hasPassword = Boolean(passwordAccount);
  const requirePassword = requiresPasswordForAccountRevoke(accounts);

  const revokePassword = async (account: LinkedAccount) => {
    setError(null);
    const result = await authClient.unlinkAccount({
      providerId: account.providerId,
      accountId: account.accountId,
    });

    if (result.error) {
      setError(result.error.message ?? m.user_account_revoke_error());
      return;
    }

    setRevokingAccount(null);
    await accountCache.reload();
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-sm leading-none font-medium">
          {m.user_account_password_title()}
        </h2>
        <p className="text-muted-foreground text-sm">
          {m.user_account_password_description()}
        </p>
      </div>
      {accountCache.accounts && hasPassword && passwordAccount ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{m.user_account_password_title()}</p>
                <Badge>{m.user_account_connected()}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {m.user_account_password_connected_description()}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevokingAccount(passwordAccount)}
            >
              {m.user_account_revoke()}
            </Button>
          </div>
          {revokingAccount ? (
            <RevokeAccountForm
              baseUrl={baseUrl}
              account={revokingAccount}
              requirePassword={requirePassword}
              onCancel={() => setRevokingAccount(null)}
              onRevoke={revokePassword}
            />
          ) : null}
          <Separator />
          <ChangePasswordForm authClient={authClient} />
        </div>
      ) : accountCache.accounts ? (
        <SetPasswordForm
          authClient={authClient}
          onSaved={accountCache.reload}
        />
      ) : !accountCache.error ? (
        <p className="text-muted-foreground text-sm">{m.user_loading()}</p>
      ) : null}
      {accountCache.error ? (
        <p className="text-destructive text-sm">{accountCache.error}</p>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </section>
  );
}

function ChangePasswordForm({ authClient }: { authClient: AuthUiClient }) {
  const m = useUserButtonMessages();
  const [saved, setSaved] = useState(false);
  const [form] = useState(() =>
    FormReact.make(changePasswordFormBuilder, {
      fields: { currentPassword: TextField, newPassword: TextField },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded }) =>
        Effect.tryPromise({
          try: async () => {
            setSaved(false);
            const result = await authClient.changePassword({
              currentPassword: decoded.currentPassword,
              newPassword: decoded.newPassword,
            });
            if (result.error) {
              throw new Error(
                result.error.message ?? m.user_account_password_change_error(),
              );
            }
            reset();
            setSaved(true);
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.user_account_password_change_error()),
        }),
    }),
  );
  const reset = useAtomSet(form.reset);
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);

  return (
    <form.Initialize defaultValues={{ currentPassword: "", newPassword: "" }}>
      <form
        className="flex w-full flex-col gap-3 sm:max-w-md"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          submit();
        }}
      >
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">
            {m.user_account_password_change_title()}
          </h3>
          <p className="text-muted-foreground text-sm">
            {m.user_account_password_change_description()}
          </p>
        </div>
        <form.currentPassword
          label={m.user_account_current_password()}
          type="password"
          autoComplete="current-password"
          required
        />
        <form.newPassword
          label={m.user_account_new_password()}
          type="password"
          autoComplete="new-password"
          required
        />
        <SubmitError result={submitResult} />
        {saved ? (
          <p className="text-sm text-green-600">
            {m.user_account_password_change_success()}
          </p>
        ) : null}
        <SubmitButton form={form}>
          {m.user_account_password_change_submit()}
        </SubmitButton>
      </form>
    </form.Initialize>
  );
}

function SetPasswordForm({
  authClient,
  onSaved,
}: {
  authClient: AuthUiClient;
  onSaved: () => Promise<void>;
}) {
  const m = useUserButtonMessages();
  const [form] = useState(() =>
    FormReact.make(passwordFormBuilder(true), {
      fields: { password: TextField },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded }) =>
        Effect.tryPromise({
          try: async () => {
            const result = await authClient.$fetch("/set-password", {
              method: "POST",
              body: { newPassword: decoded.password },
            });
            if (result.error) {
              throw new Error(
                result.error.message ?? m.user_account_password_set_error(),
              );
            }
            reset();
            await onSaved();
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.user_account_password_set_error()),
        }),
    }),
  );
  const reset = useAtomSet(form.reset);
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);

  return (
    <form.Initialize defaultValues={{ password: "" }}>
      <form
        className="flex w-full flex-col gap-3 sm:max-w-sm"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          submit();
        }}
      >
        <form.password
          label={m.user_account_new_password()}
          type="password"
          autoComplete="new-password"
          required
        />
        <SubmitError result={submitResult} />
        <SubmitButton form={form}>{m.user_account_password_set()}</SubmitButton>
      </form>
    </form.Initialize>
  );
}

function RevokeAccountForm({
  baseUrl,
  account,
  requirePassword,
  onCancel,
  onRevoke,
}: {
  baseUrl?: string | undefined;
  account: LinkedAccount;
  requirePassword: boolean;
  onCancel: () => void;
  onRevoke: (account: LinkedAccount) => Promise<void>;
}) {
  const m = useUserButtonMessages();
  const verifyPassword = useAtomSet(
    authClientApi(baseUrl).mutation("authExtra", "verifyPassword"),
    { mode: "promise" },
  );
  const [form] = useState(() =>
    FormReact.make(passwordFormBuilder(requirePassword), {
      fields: { password: TextField },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded }) =>
        Effect.tryPromise({
          try: async () => {
            if (requirePassword) {
              await verifyPassword({
                payload: { password: decoded.password },
              });
            }
            await onRevoke(account);
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.user_account_password_verify_error()),
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);

  return (
    <form.Initialize defaultValues={{ password: "" }}>
      <form
        className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          submit();
        }}
      >
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">{m.user_account_revoke()}</h3>
          <p className="text-muted-foreground text-sm">
            {m.user_account_revoke_description({
              provider: providerName(account.providerId, m),
            })}
          </p>
        </div>
        {requirePassword ? (
          <form.password
            label={m.user_field_password()}
            type="password"
            autoComplete="current-password"
            required
          />
        ) : null}
        <SubmitError result={submitResult} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {m.user_account_cancel()}
          </Button>
          {requirePassword ? (
            <SubmitButton form={form}>
              {m.user_account_confirm_revoke()}
            </SubmitButton>
          ) : (
            <Button
              type="button"
              disabled={submitResult.waiting}
              onClick={() => submit()}
            >
              {submitResult.waiting ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : null}
              {m.user_account_confirm_revoke()}
            </Button>
          )}
        </div>
      </form>
    </form.Initialize>
  );
}

const providerName = (
  providerId: string,
  m: ReturnType<typeof userButtonMessageFns>,
) => {
  if (providerId === "google") return m.user_account_google_title();
  if (providerId === "credential") return m.user_account_password_title();
  return providerId;
};

const UserForm = ({
  defaultValues,
  error,
  onSubmit,
}: {
  defaultValues: UserFormType;
  error?: string | null;
  onSubmit: (values: UserFormType) => Promise<void>;
}) => {
  const m = useUserButtonMessages();
  const [form] = useState(() =>
    FormReact.make(userFormBuilder, {
      fields: { name: TextField, image: ImageField },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded }) =>
        Effect.tryPromise({
          try: () => onSubmit({ ...decoded, image: decoded.image ?? null }),
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.user_form_update_error()),
        }),
    }),
  );
  const submit = useAtomSet(form.submit);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-sm leading-none font-medium">
          {m.user_profile_title()}
        </h2>
        <p className="text-muted-foreground text-sm">
          {m.user_profile_description()}
        </p>
      </div>
      <form.Initialize defaultValues={defaultValues}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            submit();
          }}
        >
          <form.image
            label={m.user_profile_photo_upload_label()}
            size={{
              width: 96,
              height: 96,
              suggestedWidth: 512,
              suggestedHeight: 512,
            }}
          />
          <form.name
            label={m.user_form_name_label()}
            autoComplete="name"
            required
          />
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <SubmitButton form={form} />
        </form>
      </form.Initialize>
    </section>
  );
};

function AccountSecuritySettings({
  authClient,
  accountCache,
}: {
  authClient: AuthUiClient;
  accountCache: AccountCache;
}) {
  const m = useUserButtonMessages();
  const session = authClient.useSession();
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const twoFactorEnabled = hasTwoFactorEnabled(session.data?.user);
  const requirePassword = accountCache.accounts
    ? accountCache.accounts.some(
        (account) => account.providerId === "credential",
      )
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-sm leading-none font-medium">
            {m.user_two_factor_title()}
          </h2>
          <p className="text-muted-foreground text-xs">
            {m.user_two_factor_description()}
          </p>
        </div>
        <Badge variant={twoFactorEnabled ? "default" : "secondary"}>
          {twoFactorEnabled
            ? m.user_two_factor_enabled()
            : m.user_two_factor_disabled()}
        </Badge>
      </div>
      {requirePassword === null ? (
        <p
          className={
            accountCache.error
              ? "text-destructive text-sm"
              : "text-muted-foreground text-sm"
          }
        >
          {accountCache.error ?? m.user_loading()}
        </p>
      ) : twoFactorEnabled ? (
        <DisableTotpForm
          authClient={authClient}
          requirePassword={requirePassword}
          onDisabled={async () => {
            setMessage(m.user_two_factor_disabled_message());
            await session.refetch();
          }}
        />
      ) : setup ? (
        <VerifyTotpSetup
          authClient={authClient}
          setup={setup}
          onVerified={async () => {
            setSetup(null);
            setMessage(m.user_two_factor_enabled_message());
            await session.refetch();
          }}
        />
      ) : (
        <EnableTotpForm
          authClient={authClient}
          requirePassword={requirePassword}
          onEnabled={setSetup}
        />
      )}
      {message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}
    </div>
  );
}

function EnableTotpForm({
  authClient,
  requirePassword,
  onEnabled,
}: {
  authClient: AuthUiClient;
  requirePassword: boolean;
  onEnabled: (setup: TotpSetup) => void;
}) {
  const m = useUserButtonMessages();
  const [form] = useState(() =>
    FormReact.make(passwordFormBuilder(requirePassword), {
      fields: { password: TextField },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded }) =>
        Effect.tryPromise({
          try: async () => {
            const result = await authClient.twoFactor.enable(
              requirePassword ? { password: decoded.password } : {},
            );
            if (result.error || !result.data) {
              throw new Error(
                result.error?.message ?? m.user_two_factor_enable_error(),
              );
            }
            onEnabled({
              totpURI: result.data.totpURI,
              backupCodes: result.data.backupCodes,
            });
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.user_two_factor_enable_error()),
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);

  return (
    <form.Initialize defaultValues={{ password: "" }}>
      <form
        className="flex max-w-md flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          submit();
        }}
      >
        {requirePassword ? (
          <form.password
            label={m.user_field_password()}
            type="password"
            autoComplete="current-password"
            required
          />
        ) : null}
        <SubmitError result={submitResult} />
        {requirePassword ? (
          <SubmitButton form={form}>
            {m.user_two_factor_enable_submit()}
          </SubmitButton>
        ) : (
          <Button
            type="button"
            disabled={submitResult.waiting}
            onClick={() => submit()}
          >
            {submitResult.waiting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : null}
            {m.user_two_factor_enable_submit()}
          </Button>
        )}
      </form>
    </form.Initialize>
  );
}

function VerifyTotpSetup({
  authClient,
  setup,
  onVerified,
}: {
  authClient: AuthUiClient;
  setup: TotpSetup;
  onVerified: () => Promise<void>;
}) {
  const m = useUserButtonMessages();
  const [form] = useState(() =>
    FormReact.make(totpCodeFormBuilder, {
      fields: { code: TextField },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded }) =>
        Effect.tryPromise({
          try: async () => {
            const result = await authClient.twoFactor.verifyTotp({
              code: decoded.code.trim(),
            });
            if (result.error) {
              throw new Error(
                result.error.message ?? m.user_two_factor_verify_error(),
              );
            }
            await onVerified();
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.user_two_factor_verify_error()),
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-4 rounded-lg border p-4 text-center sm:p-6">
        <div className="rounded-xl border bg-white p-3">
          <QRCode
            value={setup.totpURI}
            title={m.user_two_factor_scan_title()}
            className="size-44 max-w-full"
          />
        </div>
        <p className="text-muted-foreground max-w-md text-sm">
          {m.user_two_factor_scan_description()}
        </p>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="bg-muted/40 grid gap-2 rounded-md p-3 font-mono text-sm sm:grid-cols-2">
          {setup.backupCodes.map((code) => (
            <span key={code}>{code}</span>
          ))}
        </div>
        <p className="text-muted-foreground text-sm">
          {m.user_two_factor_backup_codes_warning()}
        </p>
      </div>
      <form.Initialize defaultValues={{ code: "" }}>
        <form
          className="flex w-full max-w-sm flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            submit();
          }}
        >
          <form.code
            label={m.user_two_factor_code()}
            autoComplete="one-time-code"
            inputMode="numeric"
            required
          />
          <SubmitError result={submitResult} />
          <SubmitButton form={form} />
        </form>
      </form.Initialize>
    </div>
  );
}

function DisableTotpForm({
  authClient,
  requirePassword,
  onDisabled,
}: {
  authClient: AuthUiClient;
  requirePassword: boolean;
  onDisabled: () => Promise<void>;
}) {
  const m = useUserButtonMessages();
  const [form] = useState(() =>
    FormReact.make(passwordFormBuilder(requirePassword), {
      fields: { password: TextField },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded }) =>
        Effect.tryPromise({
          try: async () => {
            const result = await authClient.twoFactor.disable(
              requirePassword ? { password: decoded.password } : {},
            );
            if (result.error) {
              throw new Error(
                result.error.message ?? m.user_two_factor_disable_error(),
              );
            }
            await onDisabled();
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.user_two_factor_disable_error()),
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);

  return (
    <form.Initialize defaultValues={{ password: "" }}>
      <form
        className="flex max-w-md flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          submit();
        }}
      >
        {requirePassword ? (
          <form.password
            label={m.user_field_password()}
            type="password"
            autoComplete="current-password"
            required
          />
        ) : null}
        <SubmitError result={submitResult} />
        {requirePassword ? (
          <SubmitButton form={form} />
        ) : (
          <Button
            type="button"
            disabled={submitResult.waiting}
            onClick={() => submit()}
          >
            {submitResult.waiting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : null}
            {effectFormMessages().submit}
          </Button>
        )}
      </form>
    </form.Initialize>
  );
}

function ApiKeyManager({
  authClient,
  active,
  permissionLabels,
  permissions = {},
}: {
  authClient: AuthUiClient;
  active: boolean;
  permissionLabels?: ProjectAccessLabelCatalog | undefined;
  permissions?: Readonly<Record<string, ReadonlyArray<string>>>;
}) {
  const m = useUserButtonMessages();
  const hasOpened = useOpenedOnce(active);
  const keysAtom = hasOpened ? userApiKeysAtom(authClient) : emptyApiKeysAtom;
  const keysResult = useAtomValue(keysAtom);
  const refreshKeys = useAtomRefresh(keysAtom);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const permissionOptions = getPermissionOptions(permissions);
  const [selectedPermissions, setSelectedPermissions] = useState<
    Record<string, boolean>
  >({});
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
  const permissionOptionsRef = useRef(permissionOptions);
  const selectedPermissionsRef = useRef(selectedPermissions);
  permissionOptionsRef.current = permissionOptions;
  selectedPermissionsRef.current = selectedPermissions;
  const [createForm] = useState(() =>
    FormReact.make(apiKeyFormBuilder, {
      fields: { name: TextField, referrers: TextAreaField },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded }) =>
        Effect.tryPromise({
          try: async () => {
            setCreatedKey(null);
            const created = await createApiKey(
              {
                configId: "user",
                name: decoded.name.trim(),
                permissions: getSelectedPermissionObject(
                  permissionOptionsRef.current,
                  selectedPermissionsRef.current,
                ),
                referrers: parseApiKeyReferrers(
                  decoded.referrers,
                  m.user_api_key_referrers_error(),
                ),
              },
              m.user_api_key_create_error(),
            );
            setCreatedKey(created.key);
            resetCreateForm();
            setSelectedPermissions({});
            refreshKeys();
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(m.user_api_key_create_error()),
        }),
    }),
  );
  const resetCreateForm = useAtomSet(createForm.reset);
  const submitCreateForm = useAtomSet(createForm.submit);
  const createSubmitResult = useAtomValue(createForm.submit);

  const togglePermission = (id: string, checked: boolean) => {
    setSelectedPermissions((current) => ({ ...current, [id]: checked }));
  };

  const deleteKey = async (key: ApiKeySummary) => {
    const result = await authClient.apiKey.delete({
      configId: "user",
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
                : m.user_api_keys_description()}
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
                  submitCreateForm();
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
                  idPrefix="user-create"
                  permissions={permissions}
                  labels={permissionLabels}
                  selected={selectedPermissions}
                  title={m.user_api_key_permissions()}
                  onChange={togglePermission}
                />
                <SubmitError result={createSubmitResult} />
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
                export: { baseName: m.user_api_keys_export_file_name() },
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
            configId="user"
            keyData={editingKey}
            permissions={permissions}
            permissionLabels={permissionLabels}
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
  m: ReturnType<typeof userButtonMessageFns>;
}): ColumnDef<ApiKeySummary>[] => [
  {
    accessorKey: "name",
    header: m.user_api_key_name(),
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">
          {row.original.name ?? m.user_api_key_hidden()}
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
  {
    accessorKey: "permissions",
    header: m.user_api_key_permissions(),
    cell: ({ row }) => {
      const permissions = formatPermissions(row.original.permissions);

      if (permissions.length === 0) {
        return (
          <span className="text-muted-foreground text-sm">
            {m.user_api_key_no_permissions()}
          </span>
        );
      }

      return (
        <div className="flex max-w-sm flex-wrap gap-1.5">
          {permissions.map((permission) => (
            <Badge key={permission} variant="secondary">
              {permission}
            </Badge>
          ))}
        </div>
      );
    },
  },
];

const apiKeyRowActions = ({
  m,
  onDelete,
  onEdit,
}: {
  m: ReturnType<typeof userButtonMessageFns>;
  onDelete: (key: ApiKeySummary) => void;
  onEdit: (key: ApiKeySummary) => void;
}) => [
  {
    name: m.user_api_key_edit_title(),
    icon: <Pencil />,
    onClick: onEdit,
  },
  {
    name: m.user_delete(),
    icon: <Trash2 />,
    variant: "destructive" as const,
    onClick: onDelete,
  },
];

const getPermissionId = (resource: string, action: string) =>
  `${resource}:${action}`;

const isPermissionRecord = (
  permissions: unknown,
): permissions is Record<string, string[]> =>
  typeof permissions === "object" &&
  permissions !== null &&
  Object.values(permissions).every(
    (actions) =>
      Array.isArray(actions) &&
      actions.every((action) => typeof action === "string"),
  );

const formatPermissions = (permissions: unknown) => {
  if (!isPermissionRecord(permissions)) return [];

  return Object.entries(permissions).flatMap(([resource, actions]) =>
    actions.map((action) => `${resource}:${action}`),
  );
};

const getPermissionOptions = (
  permissions: Readonly<Record<string, ReadonlyArray<string>>>,
) =>
  Object.entries(permissions).flatMap(([resource, actions]) =>
    actions.map((action) => ({
      id: getPermissionId(resource, action),
      resource,
      action,
    })),
  );

const getSelectedPermissionObject = (
  options: ReturnType<typeof getPermissionOptions>,
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

const hasTwoFactorEnabled = (user: unknown) => {
  if (
    typeof user !== "object" ||
    user === null ||
    !("twoFactorEnabled" in user)
  )
    return false;
  return user.twoFactorEnabled === true;
};

const isAuthErrorResult = (
  result: unknown,
): result is { error: { message?: string } } => {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "object" &&
    result.error !== null
  );
};
