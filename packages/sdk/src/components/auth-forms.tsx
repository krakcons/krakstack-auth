import { useAtomSet, useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Effect, Option, Schema } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckboxField,
  ErrorMessage,
  SubmitError,
  TextField,
  effectFormMessages,
} from "@krak-stack/registry/effect-form";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import type { AuthUiClient } from "./auth-client";
import { authClientApi } from "./auth-client-api";
import { type KrakstackAuthLocale, useKrakstackAuth } from "./auth-provider";
import { cn } from "./utils";
import {
  ExtraProjectPublicConfig as ExtraProjectPublicConfigSchema,
  type ExtraProjectPublicConfig,
} from "../extra/schema";

const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;

const signinFormBuilder = FormBuilder.empty
  .addField("email", Schema.String)
  .addField("password", Schema.String)
  .addField("otp", Schema.String);

const verifyEmailFormBuilder = FormBuilder.empty
  .addField("email", Schema.String)
  .addField("otp", Schema.String);

const forgotPasswordFormBuilder = FormBuilder.empty.addField(
  "email",
  Schema.String,
);

const resetPasswordFormBuilder = FormBuilder.empty.addField(
  "password",
  Schema.String,
);

const twoFactorFormBuilder = FormBuilder.empty
  .addField("code", Schema.String)
  .addField("trustDevice", Schema.Boolean);

const defaultMessages = {
  en: {
    auth_continue_with_google: "Continue with Google",
    auth_or_continue_with: "or continue with",
    auth_sign_in: "Sign in",
    field_email: "Email",
    field_password: "Password",
    forgot_password_back_to_sign_in: "Back to sign in",
    forgot_password_description:
      "Enter your email and we will send a reset link if an account exists.",
    forgot_password_error: "Unable to send password reset email.",
    forgot_password_submit: "Send reset link",
    forgot_password_success:
      "If an account exists for that email, a reset link has been sent.",
    forgot_password_title: "Reset password",
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
    sign_in_use_email_otp: "Use email code instead",
    sign_in_use_password: "Use an existing password",
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
    verify_email_code: "Verification code",
    verify_email_description:
      "Enter the one-time code sent to your email address.",
    verify_email_error: "Unable to verify email.",
    verify_email_resend: "Resend code",
    verify_email_resend_error: "Unable to send verification code.",
    verify_email_resent: "A new verification code has been sent.",
    verify_email_title: "Verify your email",
  },
  fr: {
    auth_continue_with_google: "Continuer avec Google",
    auth_or_continue_with: "ou continuez avec",
    auth_sign_in: "Se connecter",
    field_email: "Courriel",
    field_password: "Mot de passe",
    forgot_password_back_to_sign_in: "Retour à la connexion",
    forgot_password_description:
      "Saisissez votre courriel et nous enverrons un lien de réinitialisation si un compte existe.",
    forgot_password_error:
      "Impossible d'envoyer le courriel de réinitialisation.",
    forgot_password_submit: "Envoyer le lien",
    forgot_password_success:
      "Si un compte existe pour ce courriel, un lien de réinitialisation a été envoyé.",
    forgot_password_title: "Réinitialiser le mot de passe",
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
    sign_in_use_email_otp: "Utiliser un code courriel",
    sign_in_use_password: "Utiliser un mot de passe existant",
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
    verify_email_code: "Code de vérification",
    verify_email_description:
      "Saisissez le code à usage unique envoyé à votre adresse courriel.",
    verify_email_error: "Impossible de vérifier le courriel.",
    verify_email_resend: "Renvoyer le code",
    verify_email_resend_error: "Impossible d'envoyer le code de vérification.",
    verify_email_resent: "Un nouveau code de vérification a été envoyé.",
    verify_email_title: "Vérifier votre courriel",
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

interface AuthProjectConfigQuery {
  projectId?: string;
  clientId?: string;
  host?: string;
}

const useAuthProjectConfig = (
  baseUrl: string | undefined,
  searchString: string,
  projectConfig: ExtraProjectPublicConfig | null | undefined,
): ExtraProjectPublicConfig | null => {
  const projectId = getSearchParam(searchString, "projectId");
  const clientId = getSearchParam(searchString, "client_id");
  const host = getBrowserAuthHost();
  let query: AuthProjectConfigQuery = {};
  if (projectId) query = { ...query, projectId };
  if (clientId) query = { ...query, clientId };
  if (host) query = { ...query, host };
  const atom =
    projectConfig === undefined
      ? authClientApi(baseUrl).query("authExtra", "getProjectPublicConfig", {
          query,
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

  return result.value === null
    ? null
    : Schema.decodeUnknownSync(ExtraProjectPublicConfigSchema)(result.value);
};

const text = (value: string, params?: Record<string, string>) =>
  Object.entries(params ?? {}).reduce(
    (current, [key, replacement]) => current.replace(`{${key}}`, replacement),
    value,
  );

const authLinkClassName = cn(
  buttonVariants({ variant: "link", size: null }),
  "h-auto align-baseline",
);

const searchObject = (searchString: string) =>
  Object.fromEntries(new URLSearchParams(searchString));

const authMethodSearch = (
  searchString: string,
  method: "password" | "emailOtp",
  email?: string,
) => {
  const search = new URLSearchParams(searchString);
  search.set("method", method);
  if (email?.trim()) search.set("email", email.trim());
  else if (email !== undefined) search.delete("email");
  return Object.fromEntries(search);
};

type AuthMethod = "password" | "emailOtp";

export const resolveInitialAuthMethod = ({
  requestedMethod,
  lastLoginMethod,
  emailPassword,
  emailOtp,
}: {
  requestedMethod: string | null;
  lastLoginMethod: string | null | undefined;
  emailPassword: boolean;
  emailOtp: boolean;
}): AuthMethod => {
  if (requestedMethod === "password" && emailPassword) return "password";
  if (requestedMethod === "emailOtp" && emailOtp) return "emailOtp";
  if (lastLoginMethod === "email" && emailPassword) return "password";
  if (lastLoginMethod === "email-otp" && emailOtp) return "emailOtp";
  return emailOtp ? "emailOtp" : "password";
};

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
  const initialEmail = getSearchParam(searchString, "email")?.trim() ?? "";
  const oauthQuery = getOAuthQuery(searchString);
  const authOptions = projectConfig?.authOptions;
  const onNavigate = (target: string) => navigateTarget(target, navigate);
  const onTwoFactorRedirect = (href: string) => navigate({ href });
  const options = {
    emailPassword: authOptions?.emailPassword ?? true,
    emailOtp: authOptions?.emailOtp ?? true,
    google: authOptions?.google ?? true,
  };
  const requestedMethod = getSearchParam(searchString, "method");
  const [initialAuthMethod] = useState(() =>
    resolveInitialAuthMethod({
      requestedMethod,
      lastLoginMethod: authClient.getLastUsedLoginMethod?.(),
      emailPassword: options.emailPassword,
      emailOtp: options.emailOtp,
    }),
  );
  const initialMethodStep =
    Boolean(initialEmail) && requestedMethod === initialAuthMethod;
  const [emailSubmitted, setEmailSubmitted] = useState(initialMethodStep);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(initialAuthMethod);
  const [otpSentTo, setOtpSentTo] = useState(
    initialMethodStep && initialAuthMethod === "emailOtp" ? initialEmail : "",
  );
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

  const [form] = useState(() =>
    FormReact.make(signinFormBuilder, {
      fields: { email: TextField, password: TextField, otp: OtpField },
      mode: { validation: "onSubmit" },
      onSubmit: (
        action:
          | {
              type: "submit";
              emailSubmitted: boolean;
              method: "password" | "emailOtp";
              otpSent: boolean;
            }
          | { type: "sendEmailOtp" },
        { decoded: value },
      ) =>
        Effect.tryPromise({
          try: async () => {
            const email = value.email.trim();
            const sendEmailOtp = async () => {
              const result = await authClient.emailOtp.sendVerificationOtp({
                email,
                type: "sign-in",
              });
              if (result.error) {
                throw new Error(
                  result.error.message ?? m.sign_in_email_otp_send_error,
                );
              }
              setAuthMethod("emailOtp");
              setEmailSubmitted(true);
              setOtpSentTo(email);
              navigate({
                to: "/sign-in",
                search: authMethodSearch(searchString, "emailOtp", email),
                replace: true,
              });
              setEmailOtpResendAvailableAt(
                Date.now() + EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000,
              );
            };

            if (action.type === "sendEmailOtp") {
              await sendEmailOtp();
              return;
            }

            if (!action.emailSubmitted) {
              if (action.method === "emailOtp") await sendEmailOtp();
              else {
                setEmailSubmitted(true);
                navigate({
                  to: "/sign-in",
                  search: authMethodSearch(searchString, "password", email),
                  replace: true,
                });
              }
              return;
            }

            if (action.method === "emailOtp") {
              if (!action.otpSent) {
                await sendEmailOtp();
                return;
              }
              const result = await authClient.signIn.emailOtp({
                email,
                otp: value.otp.trim(),
                name: nameFromEmail(email),
              });
              if (result.error) {
                throw new Error(
                  result.error.message ?? m.sign_in_email_otp_error,
                );
              }
              onNavigate(redirectTarget);
              return;
            }

            const credentials: Parameters<typeof authClient.signIn.email>[0] & {
              oauth_query?: string;
            } = {
              email,
              password: value.password,
              callbackURL: redirectTarget,
            };
            if (oauthQuery) credentials.oauth_query = oauthQuery;
            const result = await authClient.signIn.email(credentials);
            if (result.error) {
              throw new Error(result.error.message ?? m.sign_in_error);
            }
            if (hasTwoFactorRedirect(result.data)) {
              onTwoFactorRedirect(
                `/2fa${oauthQuery ? `?${oauthQuery}` : `?callbackURL=${encodeURIComponent(redirectTarget)}`}`,
              );
              return;
            }
            onNavigate(result.data?.url ?? redirectTarget);
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(
                  action.type === "sendEmailOtp" ||
                    (action.type === "submit" &&
                      action.method === "emailOtp" &&
                      (!action.emailSubmitted || !action.otpSent))
                    ? m.sign_in_email_otp_send_error
                    : action.type === "submit" && action.method === "emailOtp"
                      ? m.sign_in_email_otp_error
                      : m.sign_in_error,
                ),
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);
  const [socialSignIn] = useState(() =>
    Atom.fn((provider: "google") =>
      Effect.tryPromise({
        try: async () => {
          const socialOptions: Parameters<
            typeof authClient.signIn.social
          >[0] & {
            oauth_query?: string;
          } = {
            provider,
            callbackURL: socialRedirectTarget,
            errorCallbackURL: "/sign-in",
          };
          if (oauthQuery) {
            socialOptions.additionalData = { query: oauthQuery };
            socialOptions.oauth_query = oauthQuery;
          }
          const result = await authClient.signIn.social(socialOptions);
          if (result.error) {
            throw new Error(result.error.message ?? m.sign_in_error);
          }
          if (result.data?.url) onNavigate(result.data.url);
        },
        catch: (cause) =>
          cause instanceof Error ? cause : new Error(m.sign_in_error),
      }),
    ),
  );
  const startSocialSignIn = useAtomSet(socialSignIn);
  const socialSignInResult = useAtomValue(socialSignIn);
  const formValues = Option.getOrElse(useAtomValue(form.values), () => ({
    email: "",
    password: "",
    otp: "",
  }));
  const resetForm = useAtomSet(form.reset);
  const setEmail = useAtomSet(form.getFieldAtoms(form.fields.email).setValue);
  const setPassword = useAtomSet(
    form.getFieldAtoms(form.fields.password).setValue,
  );
  const setOtp = useAtomSet(form.getFieldAtoms(form.fields.otp).setValue);

  const resetEmailStep = () => {
    const email = formValues.email;
    resetForm();
    setEmail(email);
    setEmailSubmitted(false);
    setOtpSentTo("");
    setEmailOtpResendAvailableAt(0);
    navigate({
      to: "/sign-in",
      search: authMethodSearch(searchString, selectedAuthMethod, ""),
      replace: true,
    });
  };

  const switchAuthMethod = () => {
    setPassword("");
    setOtp("");
    if (selectedAuthMethod === "emailOtp") {
      resetForm();
      setEmail(formValues.email);
      setAuthMethod("password");
      setOtpSentTo("");
      setEmailOtpResendAvailableAt(0);
      navigate({
        to: "/sign-in",
        search: authMethodSearch(searchString, "password", formValues.email),
        replace: true,
      });
      return;
    }
    submit({ type: "sendEmailOtp" });
  };

  const resendEmailOtp = () => {
    setOtp("");
    submit({ type: "sendEmailOtp" });
  };

  const signInWithGoogle = () => startSocialSignIn("google");

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{m.auth_sign_in}</CardTitle>
        <CardDescription>
          {!emailSubmitted ? (
            m.sign_in_description
          ) : (
            <>
              {text(m.sign_in_email_as, { email: formValues.email })}{" "}
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
          <form.Initialize
            defaultValues={{ email: initialEmail, password: "", otp: "" }}
          >
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                submit({
                  type: "submit",
                  emailSubmitted,
                  method: selectedAuthMethod,
                  otpSent: Boolean(otpSentTo),
                });
              }}
            >
              {!emailSubmitted ? (
                <form.email
                  label={m.field_email}
                  type="email"
                  autoFocus
                  autoComplete="email"
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }}
                  required
                />
              ) : null}
              {emailSubmitted && selectedAuthMethod === "password" ? (
                <div className="flex flex-col gap-2">
                  <form.password
                    label={m.field_password}
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    <Link
                      className={authLinkClassName}
                      to="/reset-password"
                      search={authMethodSearch(
                        searchString,
                        "password",
                        formValues.email.trim(),
                      )}
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
                  <form.otp label={m.sign_in_email_otp_code} />
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
              <SubmitError result={submitResult} />
              <div>
                <Button type="submit" disabled={submitResult.waiting}>
                  {submitResult.waiting ? (
                    <Loader2
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : null}
                  {!emailSubmitted
                    ? m.sign_in_continue
                    : selectedAuthMethod === "emailOtp"
                      ? m.sign_in_email_otp_verify
                      : m.auth_sign_in}
                </Button>
              </div>
            </form>
          </form.Initialize>
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
              disabled={submitResult.waiting}
              onClick={signInWithGoogle}
            >
              <GoogleLogo />
              {m.auth_continue_with_google}
            </Button>
            <SubmitError result={socialSignInResult} />
          </div>
        ) : null}
        {!hasPrimaryAuth && !options.google ? (
          <p className="text-muted-foreground text-sm">
            {m.oauth_client_no_auth_methods}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function VerifyEmail(props: AuthFormProps) {
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
  const onNavigate = (target: string) => navigateTarget(target, navigate);
  const [resent, setResent] = useState(false);
  const [form] = useState(() =>
    FormReact.make(verifyEmailFormBuilder, {
      fields: { email: TextField, otp: OtpField },
      mode: { validation: "onSubmit" },
      onSubmit: (action: "verify" | "resend", { decoded: value }) =>
        Effect.tryPromise({
          try: async () => {
            if (action === "resend") {
              const result = await authClient.emailOtp.sendVerificationOtp({
                email: value.email.trim(),
                type: "email-verification",
              });
              if (result.error) {
                throw new Error(
                  result.error.message ?? m.verify_email_resend_error,
                );
              }
              setResent(true);
              return;
            }

            const result = await authClient.emailOtp.verifyEmail({
              email: value.email.trim(),
              otp: value.otp.trim(),
            });
            if (result.error) {
              throw new Error(result.error.message ?? m.verify_email_error);
            }
            onNavigate(redirectTarget);
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(
                  action === "resend"
                    ? m.verify_email_resend_error
                    : m.verify_email_error,
                ),
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);
  const resendCode = () => submit("resend");

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{m.verify_email_title}</CardTitle>
        <CardDescription>{m.verify_email_description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form.Initialize
          defaultValues={{
            email: getSearchParam(searchString, "email") ?? "",
            otp: "",
          }}
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              submit("verify");
            }}
          >
            <form.email
              label={m.field_email}
              type="email"
              autoComplete="email"
              required
            />
            <form.otp label={m.verify_email_code} />
            <SubmitError result={submitResult} />
            {resent ? (
              <p className="text-muted-foreground text-sm">
                {m.verify_email_resent}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitResult.waiting}>
                {submitResult.waiting ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : null}
                {effectFormMessages().submit}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={submitResult.waiting}
                onClick={resendCode}
              >
                {m.verify_email_resend}
              </Button>
            </div>
          </form>
        </form.Initialize>
        <p className="text-muted-foreground mt-6 text-center text-sm">
          <Link className={authLinkClassName} to="/sign-in">
            {m.forgot_password_back_to_sign_in}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export function ForgotPassword(props: AuthFormProps) {
  const { authClient, labels: m } = useAuthFormOptions(props);
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const initialEmail = getSearchParam(searchString, "email")?.trim() ?? "";
  const [submitted, setSubmitted] = useState(false);
  const [form] = useState(() =>
    FormReact.make(forgotPasswordFormBuilder, {
      fields: { email: TextField },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded: value }) =>
        Effect.tryPromise({
          try: async () => {
            setSubmitted(false);
            const result = await authClient.requestPasswordReset({
              email: value.email.trim(),
              redirectTo: `${window.location.origin}/reset-password`,
            });
            if (result.error) {
              throw new Error(result.error.message ?? m.forgot_password_error);
            }
            setSubmitted(true);
          },
          catch: (cause) =>
            cause instanceof Error ? cause : new Error(m.forgot_password_error),
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{m.forgot_password_title}</CardTitle>
        <CardDescription>{m.forgot_password_description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form.Initialize defaultValues={{ email: initialEmail }}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              submit();
            }}
          >
            <form.email
              label={m.field_email}
              type="email"
              autoComplete="email"
              required
            />
            <SubmitError result={submitResult} />
            {submitted ? (
              <p className="bg-card text-card-foreground rounded-lg border px-4 py-3 text-sm shadow-xs">
                {m.forgot_password_success}
              </p>
            ) : null}
            <Button type="submit" disabled={submitResult.waiting}>
              {submitResult.waiting ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : null}
              {m.forgot_password_submit}
            </Button>
          </form>
        </form.Initialize>
        <p className="text-muted-foreground mt-6 text-center text-sm">
          <Link
            className={authLinkClassName}
            to="/sign-in"
            search={searchObject(searchString)}
          >
            {m.forgot_password_back_to_sign_in}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export function ResetPassword(props: AuthFormProps) {
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const token = getSearchParam(searchString, "token");

  return token ? (
    <ResetPasswordForm {...props} token={token} />
  ) : (
    <ForgotPassword {...props} />
  );
}

function ResetPasswordForm({
  token,
  ...props
}: AuthFormProps & { token: string }) {
  const { authClient, labels: m } = useAuthFormOptions(props);
  const navigate = useNavigate();
  const onSuccess = () => navigate({ to: "/sign-in" });
  const [form] = useState(() =>
    FormReact.make(resetPasswordFormBuilder, {
      fields: { password: TextField },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded: value }) =>
        Effect.tryPromise({
          try: async () => {
            const result = await authClient.resetPassword({
              newPassword: value.password,
              token,
            });
            if (result.error) {
              throw new Error(result.error.message ?? m.reset_password_error);
            }
            onSuccess();
          },
          catch: (cause) =>
            cause instanceof Error ? cause : new Error(m.reset_password_error),
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{m.reset_password_title}</CardTitle>
        <CardDescription>{m.reset_password_description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form.Initialize defaultValues={{ password: "" }}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              submit();
            }}
          >
            <form.password
              label={m.reset_password_new_password}
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <SubmitError result={submitResult} />
            <Button type="submit" disabled={submitResult.waiting}>
              {submitResult.waiting ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : null}
              {effectFormMessages().submit}
            </Button>
          </form>
        </form.Initialize>
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
  const [form] = useState(() =>
    FormReact.make(twoFactorFormBuilder, {
      fields: { code: AuthCodeField, trustDevice: CheckboxField },
      mode: { validation: "onSubmit" },
      onSubmit: (
        action:
          | { type: "verify"; mode: "totp" | "email" | "backup" }
          | {
              type: "sendEmailCode";
            },
        { decoded: value },
      ) =>
        Effect.tryPromise({
          try: async () => {
            if (action.type === "sendEmailCode") {
              const result = await authClient.twoFactor.sendOtp();
              if (result.error) {
                throw new Error(
                  result.error.message ?? m.two_factor_send_email_code_error,
                );
              }
              setEmailCodeSent(true);
              setMode("email");
              return;
            }

            const code = value.code.trim();
            const verification = oauthQuery
              ? {
                  code,
                  trustDevice: value.trustDevice,
                  oauth_query: oauthQuery,
                }
              : { code, trustDevice: value.trustDevice };
            const result =
              action.mode === "backup"
                ? await authClient.twoFactor.verifyBackupCode(verification)
                : action.mode === "email"
                  ? await authClient.twoFactor.verifyOtp(verification)
                  : await authClient.twoFactor.verifyTotp(verification);
            if (result.error) {
              throw new Error(
                result.error.message ?? m.two_factor_verify_error,
              );
            }
            onNavigate(getResultRedirectUrl(result.data) ?? redirectTarget);
          },
          catch: (cause) =>
            cause instanceof Error
              ? cause
              : new Error(
                  action.type === "sendEmailCode"
                    ? m.two_factor_send_email_code_error
                    : m.two_factor_verify_error,
                ),
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);
  const sendEmailCode = () => submit({ type: "sendEmailCode" });

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
        <form.Initialize defaultValues={{ code: "", trustDevice: true }}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              submit({ type: "verify", mode });
            }}
          >
            <form.code
              autoComplete="one-time-code"
              label={
                mode === "backup"
                  ? m.two_factor_backup_code
                  : mode === "email"
                    ? m.two_factor_email_code
                    : m.two_factor_code
              }
              otp={mode !== "backup"}
              required
            />
            <form.trustDevice label={m.two_factor_trust_device} />
            <SubmitError result={submitResult} />
            {emailCodeSent && mode === "email" ? (
              <p className="text-muted-foreground text-sm">
                {m.two_factor_email_code_sent}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitResult.waiting}>
                {submitResult.waiting ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : null}
                {effectFormMessages().submit}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={submitResult.waiting}
                onClick={sendEmailCode}
              >
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
        </form.Initialize>
      </CardContent>
    </Card>
  );
}

const OtpField: FormReact.FieldComponent<string, { label: string }> = ({
  field,
  props,
}) => {
  const invalid = Option.isSome(field.error);
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.path}>{props.label}</FieldLabel>
      <InputOTP
        id={field.path}
        name={field.path}
        maxLength={6}
        value={field.value}
        onChange={field.onChange}
        onBlur={field.onBlur}
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
      {Option.isSome(field.error) ? (
        <ErrorMessage text={field.error.value} />
      ) : null}
    </Field>
  );
};

const AuthCodeField: FormReact.FieldComponent<
  string,
  {
    autoComplete?: "one-time-code";
    label: string;
    otp: boolean;
    required?: boolean;
  }
> = ({ field, props }) => {
  if (props.otp) {
    return <OtpField field={field} props={{ label: props.label }} />;
  }

  const { otp: _, ...textFieldProps } = props;
  return <TextField field={field} props={textFieldProps} />;
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

const TwoFactorRedirect = Schema.Struct({ twoFactorRedirect: Schema.Boolean });
const RedirectResult = Schema.Struct({ url: Schema.String });

const hasTwoFactorRedirect = (data: typeof Schema.Unknown.Type) =>
  Option.exists(
    Schema.decodeUnknownOption(TwoFactorRedirect)(data),
    (result) => result.twoFactorRedirect,
  );

const getResultRedirectUrl = (data: typeof Schema.Unknown.Type) =>
  Option.map(
    Schema.decodeUnknownOption(RedirectResult)(data),
    (result) => result.url,
  ).pipe(Option.getOrNull);

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

const getBrowserAuthHost = () => globalThis.window?.location.host ?? null;

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
  if (target.startsWith(window.location.origin)) return true;
  return target.startsWith("http://") || target.startsWith("https://");
};

const nameFromEmail = (email: string) => {
  const trimmed = email.trim();
  const localPart = trimmed.split("@")[0]?.trim();
  return localPart || trimmed;
};
