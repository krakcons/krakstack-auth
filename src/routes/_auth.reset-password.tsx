import { createFileRoute } from "@tanstack/react-router";
import { ResetPassword } from "@krak-stack/auth";

import { authClient } from "@/services/auth/client";

export const Route = createFileRoute("/_auth/reset-password")({
  component: () => <ResetPassword authClient={authClient} />,
});
