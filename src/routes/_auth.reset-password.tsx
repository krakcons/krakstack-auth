import { createFileRoute } from "@tanstack/react-router";
import { ResetPassword } from "@krak-stack/auth/components";

export const Route = createFileRoute("/_auth/reset-password")({
  component: () => <ResetPassword />,
});
