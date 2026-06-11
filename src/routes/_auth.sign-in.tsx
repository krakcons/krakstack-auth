import {
  Link,
  createFileRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";

import { m } from "@/paraglide/messages";
import { authClient } from "@/services/auth/client";
import { useAppForm } from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getOAuthClientIdFromSearch,
  useOAuthClientConfigSuspense,
} from "@/services/auth/client/atoms";

export const Route = createFileRoute("/_auth/sign-in")({
  component: SignIn,
});

const hasTwoFactorRedirect = (data: unknown) => {
  if (
    typeof data !== "object" ||
    data === null ||
    !("twoFactorRedirect" in data)
  )
    return false;
  return data.twoFactorRedirect === true;
};

function SignIn() {
  const navigate = useNavigate();
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const redirectTarget = getRedirectTarget(searchString);
  const socialRedirectTarget = getSocialRedirectTarget(searchString);
  const oauthQuery = getOAuthQuery(searchString);
  const clientId = getOAuthClientIdFromSearch(searchString);
  const clientConfig = useOAuthClientConfigSuspense(clientId);
  const authOptions = clientConfig?.authOptions ?? {
    emailPassword: true,
    google: true,
    signUp: true,
  };
  const hasPrimaryAuth = authOptions.emailPassword;
  const hasSocialAuth = authOptions.google;
  const hasAnyAuth = hasPrimaryAuth || hasSocialAuth;
  const finishSignIn = (url: string | null | undefined) => {
    const target = url ?? redirectTarget;
    if (shouldUseDocumentRedirect(target)) {
      navigate({ href: target });
    } else {
      navigate({ to: target });
    }
  };
  const setFormError = (message: string) => {
    form.setErrorMap({
      onSubmit: {
        form: message,
        fields: {},
      },
    });
  };

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value, formApi }) => {
      formApi.setErrorMap({ onSubmit: undefined });

      try {
        const result = await authClient.signIn.email({
          email: value.email.trim(),
          password: value.password,
          callbackURL: redirectTarget,
          ...(oauthQuery ? { oauth_query: oauthQuery } : {}),
        });

        if (result.error) {
          formApi.setErrorMap({
            onSubmit: {
              form: result.error.message ?? m.sign_in_error(),
              fields: {},
            },
          });
          return;
        }

        if (hasTwoFactorRedirect(result.data)) {
          navigate({
            href: `${import.meta.env.VITE_SITE_URL}/2fa${oauthQuery ? `?${oauthQuery}` : `?callbackURL=${encodeURIComponent(redirectTarget)}`}`,
          });
          return;
        }

        finishSignIn(result.data?.url);
      } catch {
        formApi.setErrorMap({
          onSubmit: {
            form: m.sign_in_error(),
            fields: {},
          },
        });
        return;
      }
    },
  });

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
        setFormError(result.error.message ?? m.sign_in_error());
        return;
      }

      if (result.data?.url) finishSignIn(result.data.url);
    } catch {
      setFormError(m.sign_in_error());
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{m.auth_sign_in()}</CardTitle>
        <CardDescription>{m.sign_in_description()}</CardDescription>
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
              <form.AppField name="email">
                {(field) => (
                  <field.TextField
                    label={m.field_email()}
                    type="email"
                    autoComplete="email"
                    required
                  />
                )}
              </form.AppField>
              <form.AppField name="password">
                {(field) => (
                  <field.TextField
                    label={m.field_password()}
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                )}
              </form.AppField>
              <form.FormError />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <form.SubmitButton />
                <Link
                  className="text-foreground text-sm font-medium underline-offset-4 hover:underline"
                  to="/forgot-password"
                >
                  {m.sign_in_forgot_password()}
                </Link>
              </div>
            </form>
          </form.AppForm>
        ) : null}
        {hasSocialAuth ? (
          <div className="mt-4 flex flex-col gap-3">
            {hasPrimaryAuth ? (
              <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <span className="bg-border h-px flex-1" />
                {m.auth_or_continue_with()}
                <span className="bg-border h-px flex-1" />
              </div>
            ) : null}
            {authOptions.google ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={signInWithGoogle}
              >
                {m.auth_continue_with_google()}
              </Button>
            ) : null}
          </div>
        ) : null}
        {!hasAnyAuth ? (
          <p className="text-muted-foreground text-sm">
            {m.oauth_client_no_auth_methods()}
          </p>
        ) : null}
        {authOptions.signUp ? (
          <p className="text-muted-foreground mt-6 text-center text-sm">
            {m.sign_in_need_account()}{" "}
            <a
              className="text-foreground font-medium underline-offset-4 hover:underline"
              href={`/sign-up${searchString}`}
            >
              {m.auth_sign_up()}
            </a>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

const getRedirectTarget = (searchString: string) => {
  const oauthTarget = getOAuthAuthorizeTarget(searchString);
  if (oauthTarget) return oauthTarget;

  const search = new URLSearchParams(searchString);
  return (
    search.get("callbackURL") ??
    search.get("redirectTo") ??
    search.get("returnTo") ??
    "/admin"
  );
};

const getSocialRedirectTarget = (searchString: string) => {
  const oauthTarget = getOAuthAuthorizeTargetWithoutPromptLogin(searchString);
  if (oauthTarget) return oauthTarget;

  return getRedirectTarget(searchString);
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

const shouldUseDocumentRedirect = (target: string) => {
  const siteUrl = import.meta.env.VITE_SITE_URL;
  if (target.startsWith("/api/")) return true;
  if (target.startsWith("/")) return false;
  if (siteUrl && target.startsWith(siteUrl)) {
    return target.slice(siteUrl.length).startsWith("/api/");
  }
  return target.startsWith("http://") || target.startsWith("https://");
};
