import { createFileRoute } from "@tanstack/react-router";
import { TwoFactor } from "@krak-stack/auth";

import { authClient } from "@/services/auth/client";

export const Route = createFileRoute("/_auth/2fa")({
  component: () => <TwoFactor authClient={authClient} />,
});
