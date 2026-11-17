import type { KrakstackAuthLocale } from "./auth-provider.js";

const en = {
  organization_security: () => "Security",
  organization_security_description: () =>
    "Manage sign-in security for this organization.",
  sso_settings_title: () => "Single sign-on (SSO)",
  sso_settings_description: () =>
    "Let existing members sign in with your organization's identity provider. Password and email-code sign-in remain available.",
  sso_connection_details: () => "Identity provider",
  sso_callback_step: () => "Callback URL",
  sso_callback_help: () =>
    "Register this URL in your identity provider's app settings.",
  sso_status_enabled: () => "Enabled",
  sso_status_disabled: () => "Disabled",
  sso_update_help: () =>
    "Changing the client ID or secret disables SSO until you enable it again. Saving unchanged credentials keeps the current status. Leave the secret blank to keep it. To change the issuer or domain, remove this connection first.",
  sso_loading: () => "Loading SSO settings…",
  sso_load_error: () =>
    "Could not load SSO settings. Check that your auth server supports organization SSO and try again.",
  sso_issuer: () => "OIDC issuer URL",
  sso_domain: () => "Company email domain",
  sso_client_id: () => "Client ID",
  sso_client_secret: () => "Client secret",
  sso_secret_unchanged: () =>
    "Leave blank to keep the existing secret. Stored secrets are never displayed.",
  sso_save_help: () =>
    "Use Google, Microsoft Entra ID, Okta or Auth0. Custom provider domains require platform approval. Save to continue with callback and DNS setup; SSO stays disabled until you enable it.",
  sso_save: () => "Save connection",
  sso_callback: () => "Callback URL to register with your identity provider",
  sso_domain_verification: () => "Domain verification",
  sso_dns_help: () =>
    "Publish this DNS TXT record for your company email domain, then verify it here.",
  sso_dns_name: () => "TXT record name",
  sso_dns_value: () => "TXT record value",
  sso_verified: () => "Domain verified",
  sso_unverified: () => "Domain not yet verified",
  sso_verify: () => "Verify DNS record",
  sso_enable: () => "Enable SSO",
  sso_disable: () => "Disable SSO",
  sso_remove: () => "Remove connection",
  sso_remove_title: () => "Remove SSO connection?",
  sso_remove_warning: () =>
    "Members will no longer be able to sign in through this provider. Their accounts, memberships and other sign-in methods stay unchanged. Existing sessions remain active. Nothing is deleted from your identity provider.",
  sso_remove_confirm: () => "Remove SSO connection",
  sso_cancel: () => "Cancel",
  sso_action_error: () =>
    "Could not update SSO. Check your permissions, provider details and DNS record. A verified email domain can only be enabled for one organization.",
};

export const organizationSsoMessages = {
  en,
  fr: {
    organization_security: () => "Sécurité",
    organization_security_description: () =>
      "Gérez la sécurité de connexion de cette organisation.",
    sso_settings_title: () => "Authentification unique (SSO)",
    sso_settings_description: () =>
      "Permettez aux membres existants de se connecter avec le fournisseur d’identité de votre organisation. Le mot de passe et le code par courriel restent disponibles.",
    sso_connection_details: () => "Fournisseur d’identité",
    sso_callback_step: () => "URL de retour",
    sso_callback_help: () =>
      "Enregistrez cette URL dans les paramètres de l’application de votre fournisseur d’identité.",
    sso_status_enabled: () => "Activé",
    sso_status_disabled: () => "Désactivé",
    sso_update_help: () =>
      "La modification de l’identifiant client ou du secret désactive le SSO jusqu’à sa réactivation. Un enregistrement sans modification conserve l’état actuel. Laissez le secret vide pour le conserver. Pour changer l’émetteur ou le domaine, supprimez d’abord cette connexion.",
    sso_loading: () => "Chargement des paramètres SSO…",
    sso_load_error: () =>
      "Impossible de charger les paramètres SSO. Vérifiez que votre serveur d’authentification prend en charge le SSO d’organisation, puis réessayez.",
    sso_issuer: () => "URL de l’émetteur OIDC",
    sso_domain: () => "Domaine de courriel de l’entreprise",
    sso_client_id: () => "Identifiant client",
    sso_client_secret: () => "Secret client",
    sso_secret_unchanged: () =>
      "Laissez vide pour conserver le secret actuel. Les secrets enregistrés ne sont jamais affichés.",
    sso_save_help: () =>
      "Utilisez Google, Microsoft Entra ID, Okta ou Auth0. Les domaines personnalisés nécessitent l’approbation de la plateforme. Enregistrez pour configurer l’URL de retour et le DNS ; le SSO reste désactivé jusqu’à son activation.",
    sso_save: () => "Enregistrer la connexion",
    sso_callback: () =>
      "URL de retour à enregistrer chez votre fournisseur d’identité",
    sso_domain_verification: () => "Vérification du domaine",
    sso_dns_help: () =>
      "Publiez cet enregistrement DNS TXT pour votre domaine de courriel, puis vérifiez-le ici.",
    sso_dns_name: () => "Nom de l’enregistrement TXT",
    sso_dns_value: () => "Valeur de l’enregistrement TXT",
    sso_verified: () => "Domaine vérifié",
    sso_unverified: () => "Domaine non vérifié",
    sso_verify: () => "Vérifier l’enregistrement DNS",
    sso_enable: () => "Activer le SSO",
    sso_disable: () => "Désactiver le SSO",
    sso_remove: () => "Supprimer la connexion",
    sso_remove_title: () => "Supprimer la connexion SSO ?",
    sso_remove_warning: () =>
      "Les membres ne pourront plus se connecter via ce fournisseur. Leurs comptes, leurs adhésions et leurs autres méthodes de connexion restent inchangés. Les sessions existantes restent actives. Rien n’est supprimé chez votre fournisseur d’identité.",
    sso_remove_confirm: () => "Supprimer la connexion SSO",
    sso_cancel: () => "Annuler",
    sso_action_error: () =>
      "Impossible de modifier le SSO. Vérifiez vos permissions, la configuration du fournisseur et l’enregistrement DNS. Un domaine vérifié ne peut être activé que pour une organisation.",
  },
} satisfies Record<KrakstackAuthLocale, typeof en>;
