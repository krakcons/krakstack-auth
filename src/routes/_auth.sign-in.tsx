import { createFileRoute } from "@tanstack/react-router";
import { Signin } from "@krak-stack/auth";

import { authClient } from "@/services/auth/client";

export const Route = createFileRoute("/_auth/sign-in")({
  component: () => <Signin authClient={authClient} />,
});
