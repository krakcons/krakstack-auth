// @ts-nocheck
import { useAtomSuspense } from "@effect/atom-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { KeyRound, Mail } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { FieldError, useAppForm } from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

import type { AuthUiClient } from "./auth-client";
import { authApiClient } from "./auth-api-client";
import { type KrakstackAuthLocale, useKrakstackAuth } from "./auth-provider";
import type { ExtraProjectPublicConfig } from "../extra/schema";

const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;

const defaultMessages = {
  en: {
    auth_continue_with_google: "Continue with Google",
    auth_or_continue_with: "or continue with",
    auth_sign_in: "Sign in",
    auth_sign_up: "Sign up",
    field_email: "Email",
    field_name: "Name",
    field_password: "Password",
    forgot_password_back_to_sign_in: "Back to sign in",
    oauth_client_no_auth_methods:
      "No authentication methods are enabled for this application.",
    reset_password_description: "Enter a new password for your account.",
    reset_password_error: "Unable to reset password.",
    reset_password_missing_token: "The password reset link is missing a token.",
    reset_password_new_password: "New password",
    reset_password_title: "Choose a new password",
    sign_in_change_email: "Change",
    sign_in_continue: "Continue",
    sign_in_description: "Enter your email to continue.",
    sign_in_email_as: "Signing in as {email}",
    sign_in_email_otp_code: "Email code",
    sign_in_email_otp_error: "Unable to verify the sign-in code.",
    sign_in_email_otp_resend: "Resend code",
    sign_in_email_otp_resend_countdown: "Resend in {seconds}s",
    sign_in_email_otp_send_error: "Unable to send the sign-in code.",
    sign_in_email_otp_verify: "Verify code",
    sign_in_error: "Unable to sign in.",
    sign_in_forgot_password: "Forgot your password?",
    sign_in_need_account: "Need an account?",
    sign_in_use_email_otp: "Use email code instead",
    sign_in_use_password: "Use password instead",
    sign_up_description: "Enter your details to create an account.",
    sign_up_disabled_description:
      "New account registration is currently disabled for this project.",
    sign_up_disabled_title: "Sign-up is unavailable",
    sign_up_error: "Unable to create account.",
    sign_up_have_account: "Already have an account?",
    sign_up_title: "Create account",
    two_factor_backup_code: "Backup code",
    two_factor_code: "Authentication code",
    two_factor_email_code: "Email verification code",
    two_factor_email_code_sent: "A verification code was sent to your email.",
    two_factor_send_email_code: "Send email code",
    two_factor_send_email_code_error:
      "Could not send an email verification code.",
    two_factor_title: "Two-factor verification",
    two_factor_trust_device: "Trust this device for 30 days",
    two_factor_use_backup_code: "Use a backup code",
    two_factor_use_totp: "Use authenticator code",
    two_factor_verify_backup_description:
      "Enter one of your backup codes to continue.",
    two_factor_verify_description:
      "Enter the code from your authenticator app to continue.",
    two_factor_verify_email_description:
      "Enter the verification code sent to your email to continue.",
    two_factor_verify_error: "Could not verify the code.",
  },
  fr: {
    auth_continue_with_google: "Continuer avec Google",
    auth_or_continue_with: "ou continuez avec",
    auth_sign_in: "Se connecter",
    auth_sign_up: "S'inscrire",
    field_email: "Courriel",
    field_name: "Nom",
    field_password: "Mot de passe",
    forgot_password_back_to_sign_in: "Retour à la connexion",
    oauth_client_no_auth_methods:
      "Aucune méthode d'authentification n'est activée pour cette application.",
    reset_password_description:
      "Saisissez un nouveau mot de passe pour votre compte.",
    reset_password_error: "Impossible de réinitialiser le mot de passe.",
    reset_password_missing_token:
      "Le lien de réinitialisation du mot de passe ne contient pas de jeton.",
    reset_password_new_password: "Nouveau mot de passe",
    reset_password_title: "Choisir un nouveau mot de passe",
    sign_in_change_email: "Modifier",
    sign_in_continue: "Continuer",
    sign_in_description: "Saisissez votre courriel pour continuer.",
    sign_in_email_as: "Connexion avec {email}",
    sign_in_email_otp_code: "Code courriel",
    sign_in_email_otp_error: "Impossible de vérifier le code de connexion.",
    sign_in_email_otp_resend: "Renvoyer le code",
    sign_in_email_otp_resend_countdown: "Renvoyer dans {seconds} s",
    sign_in_email_otp_send_error: "Impossible d'envoyer le code de connexion.",
    sign_in_email_otp_verify: "Vérifier le code",
    sign_in_error: "Impossible de se connecter.",
    sign_in_forgot_password: "Mot de passe oublié?",
    sign_in_need_account: "Besoin d'un compte?",
    sign_in_use_email_otp: "Utiliser un code courriel",
    sign_in_use_password: "Utiliser le mot de passe",
    sign_up_description: "Saisissez vos informations pour créer un compte.",
    sign_up_disabled_description:
      "Les nouvelles inscriptions sont actuellement désactivées pour ce projet.",
    sign_up_disabled_title: "L'inscription est indisponible",
    sign_up_error: "Impossible de créer le compte.",
    sign_up_have_account: "Vous avez déjà un compte?",
    sign_up_title: "Créer un compte",
    two_factor_backup_code: "Code de secours",
    two_factor_code: "Code d'authentification",
    two_factor_email_code: "Code de vérification par courriel",
    two_factor_email_code_sent:
      "Un code de vérification a été envoyé à votre courriel.",
    two_factor_send_email_code: "Envoyer un code par courriel",
    two_factor_send_email_code_error:
      "Impossible d'envoyer un code de vérification par courriel.",
    two_factor_title: "Vérification à deux facteurs",
    two_factor_trust_device: "Faire confiance à cet appareil pendant 30 jours",
    two_factor_use_backup_code: "Utiliser un code de secours",
    two_factor_use_totp: "Utiliser le code d'authentification",
    two_factor_verify_backup_description:
      "Saisissez l'un de vos codes de secours pour continuer.",
    two_factor_verify_description:
      "Saisissez le code de votre application d'authentification pour continuer.",
    two_factor_verify_email_description:
      "Saisissez le code de vérification envoyé à votre courriel pour continuer.",
    two_factor_verify_error: "Impossible de vérifier le code.",
  },
} as const;

const labels = (locale: KrakstackAuthLocale) => ({
  ...defaultMessages[locale],
});

type AuthFormProps = {
  authClient?: AuthUiClient;
  baseUrl?: string | undefined;
  locale?: KrakstackAuthLocale | undefined;
};

const useAuthFormOptions = ({ authClient, baseUrl, locale }: AuthFormProps) => {
  const auth = useKrakstackAuth();
  const resolvedAuthClient = authClient ?? auth?.authClient;

  if (!resolvedAuthClient) {
    throw new Error(
      "Krakstack auth components require an authClient prop or KrakstackAuthProvider.",
    );
  }

  return {
    authClient: resolvedAuthClient,
    baseUrl: baseUrl ?? auth?.baseUrl,
    labels: labels(locale ?? auth?.locale ?? "en"),
    projectConfig: auth?.projectConfig,
  };
};

const useAuthProjectConfig = (
  baseUrl: string | undefined,
  searchString: string,
  projectConfig: ExtraProjectPublicConfig | null | undefined,
) => {
  const projectId = getSearchParam(searchString, "projectId");
  const clientId = getSearchParam(searchString, "client_id");
  const host = getBrowserAuthHost();
  const atom =
    projectConfig === undefined
      ? authApiClient(baseUrl).query("authExtra", "getProjectPublicConfig", {
          query: {
            ...(projectId ? { projectId } : {}),
            ...(clientId ? { clientId } : {}),
            ...(host ? { host } : {}),
          },
          timeToLive: "5 minutes",
          reactivityKeys: [
            "project-public-config",
            ...(projectId ? [`project:${projectId}`] : []),
            ...(clientId ? [`client:${clientId}`] : []),
            ...(host ? [`host:${host}`] : []),
          ],
          serializationKey: `project-public-config:${projectId ?? ""}:${clientId ?? ""}:${host ?? ""}`,
        })
      : Atom.make(
          AsyncResult.success<ExtraProjectPublicConfig | null, never>(
            projectConfig,
          ),
        );
  const result = useAtomSuspense(atom, { suspendOnWaiting: true });

  return result.value;
};

const text = (value: string, params?: Record<string, string>) =>
  Object.entries(params ?? {}).reduce(
    (current, [key, replacement]) => current.replace(`{${key}}`, replacement),
    value,
  );

const authLinkClassName = cn(
  buttonVariants({ variant: "link" }),
  "h-auto px-0 align-baseline",
);

const lastLoginMethodToAuthMethod = (method: string | null | undefined) =>
  method === "email" ? "password" : "emailOtp";

const searchObject = (searchString: string) =>
  Object.fromEntries(new URLSearchParams(searchString));

export function Signin(props: AuthFormProps) {
  const {
    authClient,
    baseUrl,
    labels: m,
    projectConfig: providedProjectConfig,
  } = useAuthFormOptions(props);
  const navigate = useNavigate();
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const projectConfig = useAuthProjectConfig(
    baseUrl,
    searchString,
    providedProjectConfig,
  );
  const redirectTarget = getRedirectTarget(
    searchString,
    projectConfig?.authDomain,
    projectConfig?.rootDomain,
  );
  const socialRedirectTarget = getSocialRedirectTarget(
    searchString,
    projectConfig?.authDomain,
    projectConfig?.rootDomain,
  );
  const oauthQuery = getOAuthQuery(searchString);
  const authOptions = projectConfig?.authOptions ?? {};
  const onNavigate = (target: string) => navigateTarget(target, navigate);
  const onTwoFactorRedirect = (href: string) => navigate({ href });
  const options = {
    emailPassword: authOptions.emailPassword ?? true,
    emailOtp: authOptions.emailOtp ?? true,
    google: authOptions.google ?? true,
    signUp: authOptions.signUp ?? true,
  };
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [authMethod, setAuthMethod] = useState<"password" | "emailOtp">(() =>
    lastLoginMethodToAuthMethod(authClient.getLastUsedLoginMethod?.()),
  );
  const [otpSentTo, setOtpSentTo] = useState("");
  const [emailOtpResendAvailableAt, setEmailOtpResendAvailableAt] = useState(0);
  const [emailOtpResendSeconds, setEmailOtpResendSeconds] = useState(0);
  const selectedAuthMethod =
    authMethod === "password" && options.emailPassword
      ? "password"
      : options.emailOtp
        ? "emailOtp"
        : "password";
  const hasPrimaryAuth = options.emailPassword || options.emailOtp;
  const canChangeAuthMethod = options.emailPassword && options.emailOtp;

  useEffect(() => {
    if (!emailOtpResendAvailableAt) {
      setEmailOtpResendSeconds(0);
      return;
    }

    const updateResendSeconds = () => {
      const seconds = Math.max(
        0,
        Math.ceil((emailOtpResendAvailableAt - Date.now()) / 1000),
      );
      setEmailOtpResendSeconds(seconds);
      if (seconds === 0) setEmailOtpResendAvailableAt(0);
    };

    updateResendSeconds();
    const interval = window.setInterval(updateResendSeconds, 1000);

    return () => window.clearInterval(interval);
  }, [emailOtpResendAvailableAt]);

  const form = useAppForm({
    defaultValues: { email: "", password: "", otp: "" },
    onSubmit: async ({ value, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });
      const email = value.email.trim();

      if (!emailSubmitted) {
        if (selectedAuthMethod === "emailOtp") {
          await sendEmailOtp(email, (message) =>
            formApi.setErrorMap({ onSubmit: { form: message, fields: {} } }),
          );
          return;
        }
        setEmailSubmitted(true);
        return;
      }

      try {
        if (selectedAuthMethod === "emailOtp") {
          if (!otpSentTo) {
            await sendEmailOtp(email, (message) =>
              formApi.setErrorMap({ onSubmit: { form: message, fields: {} } }),
            );
            return;
          }

          const result = await authClient.signIn.emailOtp({
            email,
            otp: value.otp.trim(),
          });
          if (result.error) {
            formApi.setErrorMap({
              onSubmit: {
                form: result.error.message ?? m.sign_in_email_otp_error,
                fields: {},
              },
            });
            return;
          }
          onNavigate(redirectTarget);
          return;
        }

        const result = await authClient.signIn.email({
          email,
          password: value.password,
          callbackURL: redirectTarget,
          ...(oauthQuery ? { oauth_query: oauthQuery } : {}),
        });
        if (result.error) {
          formApi.setErrorMap({
            onSubmit: {
              form: result.error.message ?? m.sign_in_error,
              fields: {},
            },
          });
          return;
        }
        if (hasTwoFactorRedirect(result.data)) {
          onTwoFactorRedirect(
            `/2fa${oauthQuery ? `?${oauthQuery}` : `?callbackURL=${encodeURIComponent(redirectTarget)}`}`,
          );
          return;
        }
        onNavigate(result.data?.url ?? redirectTarget);
      } catch {
        formApi.setErrorMap({
          onSubmit: {
            form:
              selectedAuthMethod === "emailOtp"
                ? m.sign_in_email_otp_error
                : m.sign_in_error,
            fields: {},
          },
        });
      }
    },
  });

  const sendEmailOtp = async (
    email: string,
    setError: (message: string) => void,
  ) => {
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (result.error) {
        setError(result.error.message ?? m.sign_in_email_otp_send_error);
        return;
      }
      setAuthMethod("emailOtp");
      setEmailSubmitted(true);
      setOtpSentTo(email);
      setEmailOtpResendAvailableAt(
        Date.now() + EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000,
      );
    } catch {
      setError(m.sign_in_email_otp_send_error);
    }
  };

  const resetEmailStep = () => {
    setEmailSubmitted(false);
    setOtpSentTo("");
    setEmailOtpResendAvailableAt(0);
    form.setFieldValue("password", "");
    form.setFieldValue("otp", "");
    form.setErrorMap({ onSubmit: undefined });
  };

  const switchAuthMethod = async () => {
    form.setErrorMap({ onSubmit: undefined });
    form.setFieldValue("password", "");
    form.setFieldValue("otp", "");
    if (selectedAuthMethod === "emailOtp") {
      setAuthMethod("password");
      setOtpSentTo("");
      setEmailOtpResendAvailableAt(0);
      return;
    }
    await sendEmailOtp(form.state.values.email.trim(), (message) =>
      form.setErrorMap({ onSubmit: { form: message, fields: {} } }),
    );
  };

  const resendEmailOtp = async () => {
    form.setErrorMap({ onSubmit: undefined });
    form.setFieldValue("otp", "");
    await sendEmailOtp(form.state.values.email.trim(), (message) =>
      form.setErrorMap({ onSubmit: { form: message, fields: {} } }),
    );
  };

  const signInWithGoogle = async () => {
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: socialRedirectTarget,
        errorCallbackURL: "/sign-in",
        ...(oauthQuery ? { additionalData: { query: oauthQuery } } : {}),
        ...(oauthQuery ? { oauth_query: oauthQuery } : {}),
      });
      if (result.error) {
        form.setErrorMap({
          onSubmit: {
            form: result.error.message ?? m.sign_in_error,
            fields: {},
          },
        });
        return;
      }
      if (result.data?.url) onNavigate(result.data.url);
    } catch {
      form.setErrorMap({ onSubmit: { form: m.sign_in_error, fields: {} } });
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{m.auth_sign_in}</CardTitle>
        <CardDescription>
          {!emailSubmitted ? (
            m.sign_in_description
          ) : (
            <>
              {text(m.sign_in_email_as, { email: form.state.values.email })}{" "}
              <Button
                type="button"
                variant="link"
                className="h-auto px-0"
                onClick={resetEmailStep}
              >
                {m.sign_in_change_email}
              </Button>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasPrimaryAuth ? (
          <form.AppForm>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                form.handleSubmit();
              }}
            >
              {!emailSubmitted ? (
                <form.AppField name="email">
                  {(field) => (
                    <field.TextField
                      label={m.field_email}
                      type="email"
                      autoComplete="email"
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        form.handleSubmit();
                      }}
                      required
                    />
                  )}
                </form.AppField>
              ) : null}
              {emailSubmitted && selectedAuthMethod === "password" ? (
                <div className="flex flex-col gap-2">
                  <form.AppField name="password">
                    {(field) => (
                      <field.TextField
                        label={m.field_password}
                        type="password"
                        autoComplete="current-password"
                        required
                      />
                    )}
                  </form.AppField>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    <Link
                      className={authLinkClassName}
                      to="/forgot-password"
                      search={searchObject(searchString)}
                    >
                      {m.sign_in_forgot_password}
                    </Link>
                    {canChangeAuthMethod ? (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto px-0"
                        onClick={switchAuthMethod}
                      >
                        <Mail />
                        {m.sign_in_use_email_otp}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {emailSubmitted && selectedAuthMethod === "emailOtp" ? (
                <div className="flex flex-col gap-2">
                  <form.AppField name="otp">
                    {(field) => (
                      <OtpInput
                        field={field}
                        label={m.sign_in_email_otp_code}
                      />
                    )}
                  </form.AppField>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    {otpSentTo ? (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto px-0"
                        disabled={emailOtpResendSeconds > 0}
                        onClick={resendEmailOtp}
                      >
                        {emailOtpResendSeconds > 0
                          ? text(m.sign_in_email_otp_resend_countdown, {
                              seconds: String(emailOtpResendSeconds),
                            })
                          : m.sign_in_email_otp_resend}
                      </Button>
                    ) : null}
                    {canChangeAuthMethod ? (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto px-0"
                        onClick={switchAuthMethod}
                      >
                        <KeyRound />
                        {m.sign_in_use_password}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <form.FormError />
              <div>
                <form.SubmitButton>
                  {!emailSubmitted
                    ? m.sign_in_continue
                    : selectedAuthMethod === "emailOtp"
                      ? m.sign_in_email_otp_verify
                      : m.auth_sign_in}
                </form.SubmitButton>
              </div>
            </form>
          </form.AppForm>
        ) : null}
        {options.google && !emailSubmitted ? (
          <div className="mt-4 flex flex-col gap-3">
            {hasPrimaryAuth ? (
              <Divider label={m.auth_or_continue_with} />
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={signInWithGoogle}
            >
              <GoogleLogo />
              {m.auth_continue_with_google}
            </Button>
          </div>
        ) : null}
        {!hasPrimaryAuth && !options.google ? (
          <p className="text-muted-foreground text-sm">
            {m.oauth_client_no_auth_methods}
          </p>
        ) : null}
        {options.signUp ? (
          <p className="text-muted-foreground mt-6 text-center text-sm">
            {m.sign_in_need_account}{" "}
            <Link
              className={authLinkClassName}
              to="/sign-up"
              search={searchObject(searchString)}
            >
              {m.auth_sign_up}
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function Signup(props: AuthFormProps) {
  const {
    authClient,
    baseUrl,
    labels: m,
    projectConfig: providedProjectConfig,
  } = useAuthFormOptions(props);
  const navigate = useNavigate();
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const projectConfig = useAuthProjectConfig(
    baseUrl,
    searchString,
    providedProjectConfig,
  );
  const redirectTarget = getRedirectTarget(
    searchString,
    projectConfig?.authDomain,
    projectConfig?.rootDomain,
  );
  const authOptions = projectConfig?.authOptions ?? {};
  const onNavigate = (target: string) => navigate({ href: target });
  const onVerifyEmail = (email: string) =>
    navigate({ to: "/verify-email", search: { email } });
  const options = {
    google: authOptions.google ?? true,
    signUp: authOptions.signUp ?? true,
    signUpName: authOptions.signUpName ?? true,
  };
  const form = useAppForm({
    defaultValues: { name: "", email: "", password: "" },
    onSubmit: async ({ value, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });
      if (!options.signUp) {
        formApi.setErrorMap({
          onSubmit: { form: m.sign_up_disabled_description, fields: {} },
        });
        return;
      }
      try {
        const result = await authClient.signUp.email({
          name: options.signUpName
            ? value.name.trim()
            : nameFromEmail(value.email),
          email: value.email.trim(),
          password: value.password,
        });
        if (result.error) {
          formApi.setErrorMap({
            onSubmit: {
              form: result.error.message ?? m.sign_up_error,
              fields: {},
            },
          });
          return;
        }
        onVerifyEmail(value.email.trim());
      } catch {
        formApi.setErrorMap({
          onSubmit: { form: m.sign_up_error, fields: {} },
        });
      }
    },
  });

  const signUpWithGoogle = async () => {
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectTarget,
        errorCallbackURL: "/sign-up",
      });
      if (result.error) {
        form.setErrorMap({
          onSubmit: {
            form: result.error.message ?? m.sign_up_error,
            fields: {},
          },
        });
        return;
      }
      if (result.data?.url) onNavigate(result.data.url);
    } catch {
      form.setErrorMap({ onSubmit: { form: m.sign_up_error, fields: {} } });
    }
  };

  if (!options.signUp) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl">{m.sign_up_disabled_title}</CardTitle>
          <CardDescription>{m.sign_up_disabled_description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center text-sm">
            {m.sign_up_have_account}{" "}
            <Link
              className={authLinkClassName}
              to="/sign-in"
              search={searchObject(searchString)}
            >
              {m.auth_sign_in}
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{m.sign_up_title}</CardTitle>
        <CardDescription>{m.sign_up_description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
          >
            {options.signUpName ? (
              <form.AppField name="name">
                {(field) => (
                  <field.TextField
                    label={m.field_name}
                    autoComplete="name"
                    required
                  />
                )}
              </form.AppField>
            ) : null}
            <form.AppField name="email">
              {(field) => (
                <field.TextField
                  label={m.field_email}
                  type="email"
                  autoComplete="email"
                  required
                />
              )}
            </form.AppField>
            <form.AppField name="password">
              {(field) => (
                <field.TextField
                  label={m.field_password}
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              )}
            </form.AppField>
            <form.FormError />
            <form.SubmitButton />
          </form>
        </form.AppForm>
        {options.google ? (
          <div className="mt-4 flex flex-col gap-3">
            <Divider label={m.auth_or_continue_with} />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={signUpWithGoogle}
            >
              <GoogleLogo />
              {m.auth_continue_with_google}
            </Button>
          </div>
        ) : null}
        <p className="text-muted-foreground mt-6 text-center text-sm">
          {m.sign_up_have_account}{" "}
          <Link
            className={authLinkClassName}
            to="/sign-in"
            search={searchObject(searchString)}
          >
            {m.auth_sign_in}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export function ResetPassword(props: AuthFormProps) {
  const { authClient, labels: m } = useAuthFormOptions(props);
  const navigate = useNavigate();
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const token = getSearchParam(searchString, "token") ?? "";
  const onSuccess = () => navigate({ to: "/sign-in" });
  const form = useAppForm({
    defaultValues: { password: "" },
    onSubmit: async ({ value, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });
      if (!token) {
        formApi.setErrorMap({
          onSubmit: { form: m.reset_password_missing_token, fields: {} },
        });
        return;
      }
      const result = await authClient.resetPassword({
        newPassword: value.password,
        token,
      });
      if (result.error) {
        formApi.setErrorMap({
          onSubmit: {
            form: result.error.message ?? m.reset_password_error,
            fields: {},
          },
        });
        return;
      }
      onSuccess();
    },
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{m.reset_password_title}</CardTitle>
        <CardDescription>{m.reset_password_description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
          >
            <form.AppField name="password">
              {(field) => (
                <field.TextField
                  label={m.reset_password_new_password}
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              )}
            </form.AppField>
            <form.FormError />
            <form.SubmitButton />
          </form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}

export function TwoFactor(props: AuthFormProps) {
  const {
    authClient,
    baseUrl,
    labels: m,
    projectConfig: providedProjectConfig,
  } = useAuthFormOptions(props);
  const navigate = useNavigate();
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const projectConfig = useAuthProjectConfig(
    baseUrl,
    searchString,
    providedProjectConfig,
  );
  const redirectTarget = getRedirectTarget(
    searchString,
    projectConfig?.authDomain,
    projectConfig?.rootDomain,
  );
  const oauthQuery = getOAuthQuery(searchString);
  const onNavigate = (target: string) => navigateTarget(target, navigate);
  const [mode, setMode] = useState<"totp" | "email" | "backup">("totp");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const form = useAppForm({
    defaultValues: { code: "", trustDevice: true },
    onSubmit: async ({ value, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });
      const code = value.code.trim();
      const result =
        mode === "backup"
          ? await authClient.twoFactor.verifyBackupCode({
              code,
              trustDevice: value.trustDevice,
              ...(oauthQuery ? { oauth_query: oauthQuery } : {}),
            })
          : mode === "email"
            ? await authClient.twoFactor.verifyOtp({
                code,
                trustDevice: value.trustDevice,
                ...(oauthQuery ? { oauth_query: oauthQuery } : {}),
              })
            : await authClient.twoFactor.verifyTotp({
                code,
                trustDevice: value.trustDevice,
                ...(oauthQuery ? { oauth_query: oauthQuery } : {}),
              });
      if (result.error) {
        formApi.setErrorMap({
          onSubmit: {
            form: result.error.message ?? m.two_factor_verify_error,
            fields: {},
          },
        });
        return;
      }
      onNavigate(getResultRedirectUrl(result.data) ?? redirectTarget);
    },
  });
  const sendEmailCode = async () => {
    form.setErrorMap({ onSubmit: undefined });
    const result = await authClient.twoFactor.sendOtp();
    if (result.error) {
      form.setErrorMap({
        onSubmit: {
          form: result.error.message ?? m.two_factor_send_email_code_error,
          fields: {},
        },
      });
      return;
    }
    setEmailCodeSent(true);
    setMode("email");
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{m.two_factor_title}</CardTitle>
        <CardDescription>
          {mode === "backup"
            ? m.two_factor_verify_backup_description
            : mode === "email"
              ? m.two_factor_verify_email_description
              : m.two_factor_verify_description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
          >
            <form.AppField name="code">
              {(field) =>
                mode === "backup" ? (
                  <field.TextField
                    label={m.two_factor_backup_code}
                    autoComplete="one-time-code"
                    required
                  />
                ) : (
                  <OtpInput
                    field={field}
                    label={
                      mode === "email"
                        ? m.two_factor_email_code
                        : m.two_factor_code
                    }
                  />
                )
              }
            </form.AppField>
            <form.AppField name="trustDevice">
              {(field) => (
                <field.CheckboxField label={m.two_factor_trust_device} />
              )}
            </form.AppField>
            <form.FormError />
            {emailCodeSent && mode === "email" ? (
              <p className="text-muted-foreground text-sm">
                {m.two_factor_email_code_sent}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <form.SubmitButton />
              <Button type="button" variant="ghost" onClick={sendEmailCode}>
                {m.two_factor_send_email_code}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMode(mode === "backup" ? "totp" : "backup")}
              >
                {mode === "backup"
                  ? m.two_factor_use_totp
                  : m.two_factor_use_backup_code}
              </Button>
            </div>
          </form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}

const OtpInput = ({ field, label }: { field: unknown; label: string }) => {
  const invalid = !field.state.meta.isValid;
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <InputOTP
        id={field.name}
        name={field.name}
        maxLength={6}
        value={field.state.value ?? ""}
        onChange={(value) => field.handleChange(value)}
        onBlur={field.handleBlur}
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern={REGEXP_ONLY_DIGITS}
        required
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} aria-invalid={invalid} />
          <InputOTPSlot index={1} aria-invalid={invalid} />
          <InputOTPSlot index={2} aria-invalid={invalid} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} aria-invalid={invalid} />
          <InputOTPSlot index={4} aria-invalid={invalid} />
          <InputOTPSlot index={5} aria-invalid={invalid} />
        </InputOTPGroup>
      </InputOTP>
      <FieldError errors={field.getMeta().errors} />
    </Field>
  );
};

const Divider = ({ label }: { label: string }) => (
  <div className="text-muted-foreground flex items-center gap-3 text-xs">
    <span className="bg-border h-px flex-1" />
    {label}
    <span className="bg-border h-px flex-1" />
  </div>
);

const GoogleLogo = () => (
  <svg
    aria-hidden="true"
    className="size-[18px]"
    viewBox="0 0 18 18"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M17.64 9.204c0-.638-.057-1.252-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.616Z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      fill="#34A853"
    />
    <path
      d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.58c1.321 0 2.508.454 3.44 1.346l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.162 6.656 3.58 9 3.58Z"
      fill="#EA4335"
    />
  </svg>
);

const hasTwoFactorRedirect = (data: unknown) =>
  typeof data === "object" &&
  data !== null &&
  "twoFactorRedirect" in data &&
  data.twoFactorRedirect === true;

const getResultRedirectUrl = (data: unknown) => {
  if (typeof data !== "object" || data === null || !("url" in data))
    return null;
  const url = data.url;
  return typeof url === "string" ? url : null;
};

const getRedirectTarget = (
  searchString: string,
  projectAuthDomain: string | null | undefined,
  projectRootDomain: string | null | undefined,
) => {
  const oauthTarget = getOAuthAuthorizeTarget(searchString);
  if (oauthTarget) return oauthTarget;

  return (
    getAuthRedirectParam(searchString) ??
    getDefaultAuthRedirectTarget(projectAuthDomain, projectRootDomain)
  );
};

const getSocialRedirectTarget = (
  searchString: string,
  projectAuthDomain: string | null | undefined,
  projectRootDomain: string | null | undefined,
) => {
  const oauthTarget = getOAuthAuthorizeTargetWithoutPromptLogin(searchString);
  if (oauthTarget) return oauthTarget;

  return getRedirectTarget(searchString, projectAuthDomain, projectRootDomain);
};

const getOAuthAuthorizeTarget = (searchString: string) => {
  if (!searchString) return null;

  const search = new URLSearchParams(searchString);
  if (!search.has("sig")) return null;

  return `/api/auth/oauth2/authorize${searchString}`;
};

const getOAuthAuthorizeTargetWithoutPromptLogin = (searchString: string) => {
  if (!searchString) return null;

  const search = new URLSearchParams(searchString);
  if (!search.has("sig")) return null;

  const prompts = search
    .get("prompt")
    ?.split(" ")
    .filter((prompt) => prompt && prompt !== "login");

  if (prompts?.length) {
    search.set("prompt", prompts.join(" "));
  } else {
    search.delete("prompt");
  }

  const nextSearchString = search.toString();
  return `/api/auth/oauth2/authorize${nextSearchString ? `?${nextSearchString}` : ""}`;
};

const getOAuthQuery = (searchString: string) => {
  if (!searchString) return null;
  const search = new URLSearchParams(searchString);
  if (!search.has("sig")) return null;

  const signedSearch = new URLSearchParams();
  for (const [key, value] of search.entries()) {
    signedSearch.append(key, value);
    if (key === "sig") break;
  }
  return signedSearch.toString();
};

const getAuthRedirectParam = (searchString: string) => {
  const search = new URLSearchParams(searchString);
  return (
    search.get("callbackURL") ??
    search.get("redirect") ??
    search.get("redirectTo") ??
    search.get("returnTo")
  );
};

const getDefaultAuthRedirectTarget = (
  _projectAuthDomain: string | null | undefined,
  _projectRootDomain: string | null | undefined,
) => {
  return "/admin";
};

const getSearchParam = (searchString: string, key: string) =>
  new URLSearchParams(searchString).get(key);

const getBrowserAuthHost = () =>
  typeof window === "undefined" ? null : window.location.host;

const navigateTarget = (
  target: string,
  navigate: ReturnType<typeof useNavigate>,
) => {
  if (shouldUseDocumentRedirect(target)) {
    navigate({ href: target });
  } else {
    navigate({ to: target });
  }
};

const shouldUseDocumentRedirect = (target: string) => {
  if (target.startsWith("/api/")) return true;
  if (target.startsWith("/")) return false;
  if (target.startsWith(window.location.origin)) {
    return target.slice(window.location.origin.length).startsWith("/api/");
  }
  return target.startsWith("http://") || target.startsWith("https://");
};

const nameFromEmail = (email: string) => {
  const trimmed = email.trim();
  const localPart = trimmed.split("@")[0]?.trim();
  return localPart || trimmed;
};
