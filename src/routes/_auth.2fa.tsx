import { createFileRoute } from "@tanstack/react-router";
import { TwoFactor } from "@krak-stack/auth/components";

export const Route = createFileRoute("/_auth/2fa")({
  component: () => <TwoFactor />,
});
