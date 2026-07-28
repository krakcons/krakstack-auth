import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { useState } from "react";

import {
  SubmitButton,
  SubmitError,
  TextField,
} from "@/components/ui/effect-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { m } from "@/paraglide/messages";
import { authClient } from "@/services/auth/client";

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPassword,
});

const forgotPasswordFormBuilder = FormBuilder.empty.addField(
  "email",
  Schema.NonEmptyString,
);

const forgotPasswordForm = FormReact.make(forgotPasswordFormBuilder, {
  fields: { email: TextField },
  onSubmit: (_, { decoded: value }) =>
    Effect.tryPromise({
      try: async () => {
        const result = await authClient.requestPasswordReset({
          email: value.email.trim(),
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (result.error) {
          throw new Error(result.error.message ?? m.forgot_password_error());
        }
      },
      catch: (cause) =>
        cause instanceof Error ? cause : new Error(m.forgot_password_error()),
    }),
});

function ForgotPassword() {
  const [successMessage, setSuccessMessage] = useState("");
  const searchString = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const submit = useAtomSet(forgotPasswordForm.submit);
  const submitResult = useAtomValue(forgotPasswordForm.submit);
  useAtomSubscribe(forgotPasswordForm.submit, (result) => {
    if (result.waiting) setSuccessMessage("");
    if (AsyncResult.isSuccess(result)) {
      setSuccessMessage(m.forgot_password_success());
    }
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{m.forgot_password_title()}</CardTitle>
        <CardDescription>{m.forgot_password_description()}</CardDescription>
      </CardHeader>
      <CardContent>
        <forgotPasswordForm.Initialize defaultValues={{ email: "" }}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              submit();
            }}
          >
            <forgotPasswordForm.email
              label={m.field_email()}
              type="email"
              autoComplete="email"
              required
            />
            <SubmitError result={submitResult} />
            {successMessage ? (
              <p className="bg-card text-card-foreground rounded-lg border px-4 py-3 text-sm shadow-xs">
                {successMessage}
              </p>
            ) : null}
            <SubmitButton form={forgotPasswordForm}>
              {m.form_submit()}
            </SubmitButton>
          </form>
        </forgotPasswordForm.Initialize>
        <p className="text-muted-foreground mt-6 text-center text-sm">
          <a
            className="text-foreground font-medium underline-offset-4 hover:underline"
            href={`/sign-in${searchString}`}
          >
            {m.forgot_password_back_to_sign_in()}
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
