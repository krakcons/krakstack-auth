import { createFileRoute } from "@tanstack/react-router";
import { Signin } from "@krak-stack/auth/components";
import * as m from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/sign-in")({
  component: () => (
    <Signin
      defaultRedirectTo="/admin"
      sso={{ label: m.auth_continue_with_sso() }}
    />
  ),
});
