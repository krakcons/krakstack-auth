import { createFileRoute } from "@tanstack/react-router";
import { VerifyEmail } from "@krak-stack/auth";

import { authClient } from "@/services/auth/client";

export const Route = createFileRoute("/_auth/verify-email")({
  validateSearch: (search) => ({
    email: typeof search.email === "string" ? search.email : "",
  }),
  component: () => <VerifyEmail authClient={authClient} />,
});
