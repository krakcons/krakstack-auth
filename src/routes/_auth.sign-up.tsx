import { createFileRoute } from "@tanstack/react-router";
import { Signup } from "@krak-stack/auth";

import { authClient } from "@/services/auth/client";

export const Route = createFileRoute("/_auth/sign-up")({
  component: () => <Signup authClient={authClient} />,
});
