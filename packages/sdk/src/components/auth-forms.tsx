import {
  RegistryContext,
  useAtomSet,
  useAtomSuspense,
  useAtomValue,
} from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import {
  Link,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { Effect, Option, Schema } from "effect";
import { Atom, AsyncResult } from "effect/reactivity";
import { HttpClientError } from "effect/http";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { ArrowLeft, KeyRound, Loader2, Mail } from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";

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

import {
  getLastUsedLoginMethod,
  notifyAuthChange,
  refreshAuthSession,
} from "./auth-atoms.js";
import { authClientApi, authHttpClient } from "./auth-client-api.js";
import { PasswordField } from "./password-field.js";
import {
  emailOtpSendsAtom,
  emailOtpSendState,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
} from "./email-otp-state.js";
import {
  passwordResetSearch,
  passwordResetConfirmation,
  passwordResetConfirmationSearch,
  passwordResetCallbackUrl,
  requestPasswordResetEmail,
  resetPasswordAndSignOut,
} from "./password-reset.js";
import {
  PasswordResetActions,
  PasswordResetFeedback,
  usePasswordResetRequest,
} from "./password-reset-flow.js";
import { type KrakstackAuthLocale, useKrakstackAuth } from "./auth-provider.js";
import { cn } from "./utils.js";
import {
  ExtraProjectPublicConfig as ExtraProjectPublicConfigSchema,
  type ExtraProjectPublicConfig,
} from "../extra/schema.js";
import {
  AuthBadRequest,
  AuthInternalServerError,
  AuthTooManyRequests,
  AuthUnauthorized,
  AuthRedirectURLFromString,
} from "../auth/schema.js";
import type {
  AuthConflict,
  AuthExpectationFailed,
  AuthForbidden,
  AuthNotFound,
} from "../auth/schema.js";

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
    auth_or_continue_with: "Or",
    auth_sign_in: "Sign in",
    field_email: "Email",
    field_password: "Password",
    forgot_password_back_to_sign_in: "Back to sign in",
    forgot_password_change_email: "Change email",
    forgot_password_description:
      "Enter your email and we will send a reset link if an account exists.",
    forgot_password_error: "Unable to send password reset email.",
    forgot_password_submit: "Send reset link",
    forgot_password_success:
      "If an account exists for that email, a reset link has been sent.",
    forgot_password_title: "Reset password",
    user_password_reset_title: "Check your email",
    user_password_reset_sending: "Sending reset email…",
    user_password_reset_resend: "Resend email",
    user_password_reset_countdown: "Resend in {seconds}s",
    forgot_password_success_email:
      "If an account exists for {email}, we’ve sent a password-reset link.",
    error_network:
      "We couldn't reach the server. Check your connection and try again.",
    error_rate_limited:
      "Too many attempts. Please wait a moment before trying again.",
    error_service_unavailable:
      "The authentication service is temporarily unavailable. Please try again.",
    oauth_client_no_auth_methods:
      "No authentication methods are enabled for this application.",
    reset_password_description: "Enter a new password for your account.",
    reset_password_error: "Unable to reset password.",
    reset_password_missing_token: "The password reset link is missing a token.",
    reset_password_new_password: "New password",
    reset_password_title: "Choose a new password",
    sign_in_change_email: "Back",
    sign_in_continue: "Continue",
    sign_in_description: "Enter your email to continue.",
    sign_in_email_as: "Signing in as {email}",
    sign_in_email_otp_code: "Email code",
    sign_in_email_otp_error: "Unable to verify the sign-in code.",
    sign_in_otp_expiry: "Your code expires 5 minutes after it's sent.",
    sign_in_email_otp_resend: "Resend code",
    sign_in_email_otp_resend_countdown: "Resend in {seconds}s",
    sign_in_email_otp_send_error: "Unable to send the sign-in code.",
    sign_in_email_otp_verify: "Verify code",
    sign_in_error: "Unable to sign in.",
    sign_in_invalid_credentials: "The email or password is incorrect.",
    auth_invalid_code: "The code is invalid or has expired.",
    sign_in_forgot_password: "Forgot your password?",
    sign_in_use_email_otp: "Use email code",
    sign_in_use_password: "Use password",
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
    auth_or_continue_with: "Ou",
    auth_sign_in: "Se connecter",
    field_email: "Courriel",
    field_password: "Mot de passe",
    forgot_password_back_to_sign_in: "Retour à la connexion",
    forgot_password_change_email: "Modifier le courriel",
    forgot_password_description:
      "Saisissez votre courriel et nous enverrons un lien de réinitialisation si un compte existe.",
    forgot_password_error:
      "Impossible d'envoyer le courriel de réinitialisation.",
    forgot_password_submit: "Envoyer le lien",
    forgot_password_success:
      "Si un compte existe pour ce courriel, un lien de réinitialisation a été envoyé.",
    forgot_password_title: "Réinitialiser le mot de passe",
    user_password_reset_title: "Consultez votre courriel",
    user_password_reset_sending: "Envoi du courriel de réinitialisation…",
    user_password_reset_resend: "Renvoyer le courriel",
    user_password_reset_countdown: "Renvoyer dans {seconds} s",
    forgot_password_success_email:
      "Si un compte existe pour {email}, nous avons envoyé un lien de réinitialisation.",
    error_network:
      "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
    error_rate_limited:
      "Trop de tentatives. Veuillez patienter un moment avant de réessayer.",
    error_service_unavailable:
      "Le service d'authentification est temporairement indisponible. Veuillez réessayer.",
    oauth_client_no_auth_methods:
      "Aucune méthode d'authentification n'est activée pour cette application.",
    reset_password_description:
      "Saisissez un nouveau mot de passe pour votre compte.",
    reset_password_error: "Impossible de réinitialiser le mot de passe.",
    reset_password_missing_token:
      "Le lien de réinitialisation du mot de passe ne contient pas de jeton.",
    reset_password_new_password: "Nouveau mot de passe",
    reset_password_title: "Choisir un nouveau mot de passe",
    sign_in_change_email: "Retour",
    sign_in_continue: "Continuer",
    sign_in_description: "Saisissez votre courriel pour continuer.",
    sign_in_email_as: "Connexion avec {email}",
    sign_in_email_otp_code: "Code courriel",
    sign_in_email_otp_error: "Impossible de vérifier le code de connexion.",
    sign_in_otp_expiry: "Votre code expire 5 minutes après son envoi.",
    sign_in_email_otp_resend: "Renvoyer le code",
    sign_in_email_otp_resend_countdown: "Renvoyer dans {seconds} s",
    sign_in_email_otp_send_error: "Impossible d'envoyer le code de connexion.",
    sign_in_email_otp_verify: "Vérifier le code",
    sign_in_error: "Impossible de se connecter.",
    sign_in_invalid_credentials:
      "Le courriel ou le mot de passe est incorrect.",
    auth_invalid_code: "Le code est invalide ou a expiré.",
    sign_in_forgot_password: "Mot de passe oublié?",
    sign_in_use_email_otp: "Utiliser un code courriel",
    sign_in_use_password: "Utiliser un mot de passe",
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

type AuthErrorMessages = {
  fallback: string;
  badRequest?: string | undefined;
  unauthorized?: string | undefined;
};

type AuthClientError =
  | AuthBadRequest
  | AuthUnauthorized
  | AuthForbidden
  | AuthNotFound
  | AuthConflict
  | AuthExpectationFailed
  | AuthTooManyRequests
  | AuthInternalServerError
  | HttpClientError.HttpClientError
  | Schema.SchemaError;

const AuthSubmitError = <A,>({
  result,
  labels: m,
  messages,
}: {
  result: AsyncResult.AsyncResult<A, AuthClientError>;
  labels: ReturnType<typeof labels>;
  messages: AuthErrorMessages;
}) => {
  const error = Option.getOrUndefined(AsyncResult.error(result));
  if (!error) return null;

  let message = messages.fallback;
  if (error instanceof AuthBadRequest) {
    message = messages.badRequest ?? messages.fallback;
  } else if (error instanceof AuthUnauthorized) {
    message = messages.unauthorized ?? messages.fallback;
  } else if (error instanceof AuthTooManyRequests) {
    message = m.error_rate_limited;
  } else if (error instanceof AuthInternalServerError) {
    message = m.error_service_unavailable;
  } else if (HttpClientError.isHttpClientError(error)) {
    message =
      error.reason._tag === "TransportError"
        ? m.error_network
        : error.reason._tag === "StatusCodeError" &&
            error.reason.response.status === 429
          ? m.error_rate_limited
          : m.error_service_unavailable;
  } else if (Schema.isSchemaError(error)) {
    return null;
  }

  return <ErrorMessage text={message} />;
};

type AuthFormProps = {
  baseUrl?: string | undefined;
  locale?: KrakstackAuthLocale | undefined;
  defaultRedirectTo?: string | undefined;
};

type SigninErrorContext =
  | "signIn"
  | "sendEmailOtp"
  | "verifyEmailOtp"
  | "resetPassword";

const useAuthFormOptions = ({ baseUrl, locale }: AuthFormProps) => {
  const auth = useKrakstackAuth();
  const resolvedLocale = locale ?? auth?.locale ?? "en";
  const localeRef = useRef(resolvedLocale);
  useEffect(() => {
    localeRef.current = resolvedLocale;
  }, [resolvedLocale]);

  return {
    baseUrl: baseUrl ?? auth?.baseUrl,
    // Form atoms retain their initial handlers; resolve the locale when sending.
    locale: () => localeRef.current,
    labels: labels(resolvedLocale),
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
  const registry = useContext(RegistryContext);
  const {
    baseUrl,
    locale,
    labels: m,
    projectConfig: providedProjectConfig,
  } = useAuthFormOptions(props);
  const router = useRouter();
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
    props.defaultRedirectTo,
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
      lastLoginMethod: getLastUsedLoginMethod(),
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
  const otpSends = useAtomValue(emailOtpSendsAtom(baseUrl ?? ""));
  const persistOtpSends = useAtomSet(emailOtpSendsAtom(baseUrl ?? ""));
  const otpSendsRef = useRef(otpSends);
  otpSendsRef.current = otpSends;
  const [errorContext, setErrorContext] =
    useState<SigninErrorContext>("signIn");
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
      runtime: authClientApi(baseUrl).runtime,
      fields: { email: TextField, password: PasswordField, otp: OtpField },
      mode: { validation: "onSubmit" },
      onSubmit: (
        action:
          | {
              type: "submit";
              emailSubmitted: boolean;
              method: "password" | "emailOtp";
              otpSent: boolean;
            }
          | { type: "sendEmailOtp" }
          | { type: "resendEmailOtp" }
          | { type: "resetPassword" },
        { decoded: value },
      ) =>
        Effect.gen(function* () {
          const email = value.email.trim();
          if (action.type === "resetPassword") {
            yield* requestPasswordResetEmail({
              baseUrl,
              locale,
              email,
              redirectTo: passwordResetCallbackUrl(
                searchString,
                window.location.origin,
                email,
              ),
            });
            yield* Effect.promise(() =>
              navigate({
                to: "/reset-password",
                search: passwordResetConfirmationSearch(
                  searchString,
                  email,
                  Date.now(),
                ),
              }),
            );
            return;
          }
          const previousSend = otpSendsRef.current[email];
          const previousSendState = emailOtpSendState(previousSend, Date.now());
          const reuseCode =
            previousSendState.reusable &&
            (action.type !== "resendEmailOtp" ||
              previousSendState.resendSeconds > 0);
          const sendEmailOtp = (
            reuseCode
              ? Effect.void
              : authHttpClient(baseUrl, locale).pipe(
                  Effect.flatMap((client) =>
                    client.auth.sendVerificationOtp({
                      payload: { email, type: "sign-in" },
                    }),
                  ),
                  Effect.asVoid,
                  Effect.tap(() =>
                    Effect.sync(() => {
                      const sends = {
                        ...otpSendsRef.current,
                        [email]: Date.now(),
                      };
                      otpSendsRef.current = sends;
                      persistOtpSends(sends);
                    }),
                  ),
                )
          ).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                setAuthMethod("emailOtp");
                setEmailSubmitted(true);
                setOtpSentTo(email);
                navigate({
                  to: "/sign-in",
                  search: authMethodSearch(searchString, "emailOtp", email),
                  replace: true,
                });
                setEmailOtpResendAvailableAt(
                  (otpSendsRef.current[email] ?? 0) +
                    EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000,
                );
              }),
            ),
          );

          if (
            action.type === "sendEmailOtp" ||
            action.type === "resendEmailOtp"
          ) {
            yield* sendEmailOtp;
            return;
          }

          if (!action.emailSubmitted) {
            if (action.method === "emailOtp") yield* sendEmailOtp;
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
              yield* sendEmailOtp;
              return;
            }
            yield* authHttpClient(baseUrl, locale).pipe(
              Effect.flatMap((client) =>
                client.auth.signInEmailOtp({
                  payload: {
                    email,
                    otp: value.otp.trim(),
                    name: nameFromEmail(email),
                  },
                }),
              ),
            );
            yield* refreshAuthSession(registry, baseUrl);
            onNavigate(redirectTarget);
            return;
          }

          const payload = oauthQuery
            ? {
                email,
                password: value.password,
                callbackURL: redirectTarget,
                oauth_query: oauthQuery,
              }
            : {
                email,
                password: value.password,
                callbackURL: redirectTarget,
              };
          const result = yield* authHttpClient(baseUrl, locale).pipe(
            Effect.flatMap((client) => client.auth.signInEmail({ payload })),
          );
          if (hasTwoFactorRedirect(result)) {
            onTwoFactorRedirect(
              `/2fa${oauthQuery ? `?${oauthQuery}` : `?callbackURL=${encodeURIComponent(redirectTarget)}`}`,
            );
            return;
          }
          yield* refreshAuthSession(registry, baseUrl);
          onNavigate(result.url ?? redirectTarget);
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);
  const [socialSignIn] = useState(() =>
    authClientApi(baseUrl).runtime.fn(
      (input: {
        callbackURL: string;
        errorCallbackURL: string;
        oauthQuery: string | null;
      }) =>
        Effect.gen(function* () {
          const payload = input.oauthQuery
            ? {
                provider: "google",
                callbackURL: input.callbackURL,
                errorCallbackURL: input.errorCallbackURL,
                additionalData: { query: input.oauthQuery },
                oauth_query: input.oauthQuery,
              }
            : {
                provider: "google",
                callbackURL: input.callbackURL,
                errorCallbackURL: input.errorCallbackURL,
              };
          const result = yield* authHttpClient(baseUrl, locale).pipe(
            Effect.flatMap((client) => client.auth.signInSocial({ payload })),
          );
          notifyAuthChange();
          if (result.url) onNavigate(result.url);
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
  const lastOtpSentAt = otpSends[formValues.email.trim()];
  useEffect(() => {
    setEmailOtpResendAvailableAt(
      (lastOtpSentAt ?? 0) + EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000,
    );
  }, [lastOtpSentAt]);
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
      navigate({
        to: "/sign-in",
        search: authMethodSearch(searchString, "password", formValues.email),
        replace: true,
      });
      return;
    }
    setErrorContext("sendEmailOtp");
    submit({ type: "sendEmailOtp" });
  };

  const resendEmailOtp = () => {
    setOtp("");
    setErrorContext("sendEmailOtp");
    submit({ type: "resendEmailOtp" });
  };

  const signInWithGoogle = () =>
    startSocialSignIn(
      getSocialSignInDestinations(
        router,
        props.defaultRedirectTo,
        window.location.href,
      ),
    );

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        {emailSubmitted ? (
          <Button
            type="button"
            variant="link"
            className="w-fit justify-self-start p-0"
            disabled={submitResult.waiting}
            onClick={resetEmailStep}
          >
            <ArrowLeft />
            {m.sign_in_change_email}
          </Button>
        ) : null}
        <CardTitle className="text-3xl">{m.auth_sign_in}</CardTitle>
        <CardDescription>
          {!emailSubmitted
            ? m.sign_in_description
            : text(m.sign_in_email_as, { email: formValues.email })}
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
                setErrorContext(
                  !emailSubmitted ||
                    (selectedAuthMethod === "emailOtp" && !otpSentTo)
                    ? "sendEmailOtp"
                    : selectedAuthMethod === "emailOtp"
                      ? "verifyEmailOtp"
                      : "signIn",
                );
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
                    autoFocus
                    autoComplete="current-password"
                    recovery={{
                      label: m.sign_in_forgot_password,
                      disabled: submitResult.waiting,
                      onClick: () => {
                        setErrorContext("resetPassword");
                        submit({ type: "resetPassword" });
                      },
                    }}
                    required
                  />
                </div>
              ) : null}
              {emailSubmitted && selectedAuthMethod === "emailOtp" ? (
                <div className="flex flex-col gap-2">
                  <form.otp label={m.sign_in_email_otp_code} />
                  <p className="text-muted-foreground text-sm">
                    {m.sign_in_otp_expiry}
                  </p>
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
                  </div>
                </div>
              ) : null}
              <AuthSubmitError
                result={submitResult}
                labels={m}
                messages={{
                  fallback:
                    errorContext === "resetPassword"
                      ? m.forgot_password_error
                      : errorContext === "sendEmailOtp"
                        ? m.sign_in_email_otp_send_error
                        : errorContext === "verifyEmailOtp"
                          ? m.sign_in_email_otp_error
                          : m.sign_in_error,
                  badRequest:
                    errorContext === "resetPassword"
                      ? m.forgot_password_error
                      : errorContext === "verifyEmailOtp"
                        ? m.auth_invalid_code
                        : errorContext === "signIn"
                          ? m.sign_in_invalid_credentials
                          : m.sign_in_email_otp_send_error,
                  unauthorized:
                    errorContext === "resetPassword"
                      ? m.forgot_password_error
                      : errorContext === "signIn"
                        ? m.sign_in_invalid_credentials
                        : m.sign_in_error,
                }}
              />
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
        {(emailSubmitted && canChangeAuthMethod) ||
        (options.google && !emailSubmitted) ? (
          <div className="mt-4 flex flex-col gap-3">
            {hasPrimaryAuth ? (
              <Divider label={m.auth_or_continue_with} />
            ) : null}
            {emailSubmitted && canChangeAuthMethod ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={submitResult.waiting}
                onClick={switchAuthMethod}
              >
                {selectedAuthMethod === "password" ? <Mail /> : <KeyRound />}
                {selectedAuthMethod === "password"
                  ? m.sign_in_use_email_otp
                  : m.sign_in_use_password}
              </Button>
            ) : null}
            {options.google && !emailSubmitted ? (
              <>
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
                <AuthSubmitError
                  result={socialSignInResult}
                  labels={m}
                  messages={{ fallback: m.sign_in_error }}
                />
              </>
            ) : null}
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
  const registry = useContext(RegistryContext);
  const { baseUrl, locale, labels: m } = useAuthFormOptions(props);
  const navigate = useNavigate();
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const redirectTarget = getRedirectTarget(
    searchString,
    props.defaultRedirectTo,
  );
  const onNavigate = (target: string) => navigateTarget(target, navigate);
  const [resent, setResent] = useState(false);
  const [lastAction, setLastAction] = useState<"verify" | "resend">("verify");
  const [form] = useState(() =>
    FormReact.make(verifyEmailFormBuilder, {
      runtime: authClientApi(baseUrl).runtime,
      fields: { email: TextField, otp: OtpField },
      mode: { validation: "onSubmit" },
      onSubmit: (action: "verify" | "resend", { decoded: value }) =>
        Effect.gen(function* () {
          if (action === "resend") {
            yield* authHttpClient(baseUrl, locale).pipe(
              Effect.flatMap((client) =>
                client.auth.sendVerificationOtp({
                  payload: {
                    email: value.email.trim(),
                    type: "email-verification",
                  },
                }),
              ),
            );
            setResent(true);
            return;
          }

          yield* authHttpClient(baseUrl, locale).pipe(
            Effect.flatMap((client) =>
              client.auth.verifyEmailOtp({
                payload: {
                  email: value.email.trim(),
                  otp: value.otp.trim(),
                },
              }),
            ),
          );
          yield* refreshAuthSession(registry, baseUrl);
          onNavigate(redirectTarget);
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);
  const resendCode = () => {
    setLastAction("resend");
    submit("resend");
  };

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
              setLastAction("verify");
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
            <AuthSubmitError
              result={submitResult}
              labels={m}
              messages={{
                fallback:
                  lastAction === "resend"
                    ? m.verify_email_resend_error
                    : m.verify_email_error,
                badRequest:
                  lastAction === "verify"
                    ? m.auth_invalid_code
                    : m.verify_email_resend_error,
              }}
            />
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
  const { baseUrl, locale, labels: m } = useAuthFormOptions(props);
  const navigate = useNavigate();
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const initialEmail = getSearchParam(searchString, "email")?.trim() ?? "";
  const confirmation = passwordResetConfirmation(searchString);
  const passwordReset = usePasswordResetRequest(
    baseUrl,
    confirmation?.resetSentAt,
  );
  const resetEmailInput = (email: string) => ({
    locale,
    email,
    redirectTo: passwordResetCallbackUrl(
      searchString,
      window.location.origin,
      email,
    ),
    onSent: (sentAt: number) =>
      navigate({
        to: "/reset-password",
        search: passwordResetConfirmationSearch(searchString, email, sentAt),
        replace: true,
      }),
  });
  const requestResetEmail = (email: string) =>
    passwordReset.request(resetEmailInput(email));
  const [form] = useState(() =>
    FormReact.make(forgotPasswordFormBuilder, {
      runtime: authClientApi(baseUrl).runtime,
      fields: { email: TextField },
      mode: { validation: "onSubmit" },
      onSubmit: (
        action: { requestEmail: typeof requestResetEmail },
        { decoded: value },
      ) => action.requestEmail(value.email.trim()),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);
  const feedback = (
    <PasswordResetFeedback
      pending={passwordReset.result.waiting}
      sendingLabel={m.user_password_reset_sending}
      error={
        <AuthSubmitError
          result={passwordReset.result}
          labels={m}
          messages={{ fallback: m.forgot_password_error }}
        />
      }
    />
  );

  if (confirmation) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl">
            {m.user_password_reset_title}
          </CardTitle>
          <CardDescription>
            {text(m.forgot_password_success_email, {
              email: confirmation.email,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {feedback}
            <PasswordResetActions
              pending={passwordReset.result.waiting}
              resendSeconds={passwordReset.resendSeconds}
              onResend={() =>
                passwordReset.send(resetEmailInput(confirmation.email))
              }
              resendLabel={m.user_password_reset_resend}
              countdownLabel={(seconds) =>
                text(m.user_password_reset_countdown, {
                  seconds: String(seconds),
                })
              }
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{m.forgot_password_title}</CardTitle>
        <CardDescription>{m.forgot_password_description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form.Initialize
          key={initialEmail}
          defaultValues={{ email: initialEmail }}
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              submit({ requestEmail: requestResetEmail });
            }}
          >
            <form.email
              label={m.field_email}
              type="email"
              autoComplete="email"
              required
            />
            {feedback}
            <Button
              type="submit"
              className="self-start"
              disabled={submitResult.waiting || passwordReset.result.waiting}
            >
              {submitResult.waiting || passwordReset.result.waiting ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : null}
              {m.forgot_password_submit}
            </Button>
          </form>
        </form.Initialize>
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
  const { baseUrl, locale, labels: m } = useAuthFormOptions(props);
  const navigate = useNavigate();
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const onSuccess = () =>
    navigate({ to: "/sign-in", search: passwordResetSearch(searchString) });
  const [form] = useState(() =>
    FormReact.make(resetPasswordFormBuilder, {
      runtime: authClientApi(baseUrl).runtime,
      fields: { password: PasswordField },
      mode: { validation: "onSubmit" },
      onSubmit: (_, { decoded: value }) =>
        Effect.gen(function* () {
          yield* resetPasswordAndSignOut({
            baseUrl,
            locale,
            newPassword: value.password,
            token,
          });
          notifyAuthChange();
          onSuccess();
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
              autoComplete="new-password"
              minLength={8}
              required
            />
            <AuthSubmitError
              result={submitResult}
              labels={m}
              messages={{ fallback: m.reset_password_error }}
            />
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
  const registry = useContext(RegistryContext);
  const { baseUrl, locale, labels: m } = useAuthFormOptions(props);
  const navigate = useNavigate();
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const redirectTarget = getRedirectTarget(
    searchString,
    props.defaultRedirectTo,
  );
  const oauthQuery = getOAuthQuery(searchString);
  const onNavigate = (target: string) => navigateTarget(target, navigate);
  const [mode, setMode] = useState<"totp" | "email" | "backup">("totp");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [lastAction, setLastAction] = useState<"verify" | "sendEmailCode">(
    "verify",
  );
  const [form] = useState(() =>
    FormReact.make(twoFactorFormBuilder, {
      runtime: authClientApi(baseUrl).runtime,
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
        Effect.gen(function* () {
          if (action.type === "sendEmailCode") {
            yield* authHttpClient(baseUrl, locale).pipe(
              Effect.flatMap((client) =>
                client.auth.twoFactorSendOtp({ payload: {} }),
              ),
            );
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
          const result = yield* authHttpClient(baseUrl, locale).pipe(
            Effect.flatMap((client) =>
              action.mode === "backup"
                ? client.auth.twoFactorVerifyBackupCode({
                    payload: verification,
                  })
                : action.mode === "email"
                  ? client.auth.twoFactorVerifyOtp({
                      payload: verification,
                    })
                  : client.auth.twoFactorVerifyTotp({
                      payload: verification,
                    }),
            ),
          );
          yield* refreshAuthSession(registry, baseUrl);
          onNavigate(getResultRedirectUrl(result) ?? redirectTarget);
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const submitResult = useAtomValue(form.submit);
  const sendEmailCode = () => {
    setLastAction("sendEmailCode");
    submit({ type: "sendEmailCode" });
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
        <form.Initialize defaultValues={{ code: "", trustDevice: true }}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setLastAction("verify");
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
            <AuthSubmitError
              result={submitResult}
              labels={m}
              messages={{
                fallback:
                  lastAction === "sendEmailCode"
                    ? m.two_factor_send_email_code_error
                    : m.two_factor_verify_error,
                badRequest:
                  lastAction === "verify"
                    ? m.auth_invalid_code
                    : m.two_factor_send_email_code_error,
              }}
            />
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

export const getRedirectTarget = (
  searchString: string,
  defaultRedirectTo = "/",
) => {
  const oauthTarget = getOAuthAuthorizeTarget(searchString);
  if (oauthTarget) return oauthTarget;

  const decode = Schema.decodeUnknownOption(AuthRedirectURLFromString());
  const target = getAuthRedirectParam(searchString);
  if (target && Option.isSome(decode(target))) return target;
  return Option.isSome(decode(defaultRedirectTo)) ? defaultRedirectTo : "/";
};

export const getSocialRedirectTarget = (
  searchString: string,
  defaultRedirectTo = "/",
  origin = globalThis.window?.location.origin,
) => {
  const oauthTarget = getOAuthAuthorizeTargetWithoutPromptLogin(searchString);
  const target =
    oauthTarget ?? getRedirectTarget(searchString, defaultRedirectTo);
  // A relative callback is otherwise resolved against the auth backend, which
  // may be a different origin from the site displaying the sign-in form.
  if (!origin) return target;
  return Schema.decodeUnknownOption(AuthRedirectURLFromString(origin))(
    target,
  ).pipe(
    Option.map((url) => url.href),
    Option.getOrElse(() => origin),
  );
};

export const getSocialSignInDestinations = (
  router: ReturnType<typeof useRouter>,
  defaultRedirectTo = "/",
  browserHref: string,
) => {
  const browserURL = Schema.decodeUnknownSync(AuthRedirectURLFromString())(
    browserHref,
  );
  const searchString = router.state.location.searchStr;
  const defaultTarget = getRedirectTarget("", defaultRedirectTo);
  const defaultURL = Schema.decodeUnknownSync(
    AuthRedirectURLFromString(browserURL.origin),
  )(defaultTarget);
  const defaultHref = Option.isSome(
    Schema.decodeUnknownOption(Schema.URLFromString)(defaultTarget),
  )
    ? defaultTarget
    : router.buildLocation({
        to: defaultURL.pathname,
        search: Object.fromEntries(defaultURL.searchParams),
        hash: defaultURL.hash.slice(1),
      }).publicHref;
  // Resolve at click time so router rewrites use the current locale. Error
  // callbacks return to the actual browser-facing sign-in route, not a guessed
  // locale-prefixed path.
  browserURL.searchParams.delete("error");
  return {
    callbackURL: getSocialRedirectTarget(
      searchString,
      defaultHref,
      browserURL.origin,
    ),
    errorCallbackURL: browserURL.href,
    oauthQuery: getOAuthQuery(searchString),
  };
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

const getSearchParam = (searchString: string, key: string) =>
  new URLSearchParams(searchString).get(key);

const getBrowserAuthHost = () => globalThis.window?.location.host ?? null;

export const navigateTarget = (
  target: string,
  navigate: ReturnType<typeof useNavigate>,
) => {
  // Return destinations are complete URLs, including any search and hash.
  // API callbacks must reach the server rather than the client route tree.
  if (target.startsWith("/api/") || URL.canParse(target)) {
    globalThis.window.location.href = target;
    return;
  }

  const url = new URL(target, "http://localhost");
  return navigate({
    to: url.pathname,
    search: Object.fromEntries(url.searchParams),
    hash: url.hash.slice(1),
  });
};

const nameFromEmail = (email: string) => {
  const trimmed = email.trim();
  const localPart = trimmed.split("@")[0]?.trim();
  return localPart || trimmed;
};
