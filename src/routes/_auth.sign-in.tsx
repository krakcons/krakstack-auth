import { createFileRoute } from "@tanstack/react-router";
import { Signin } from "@krak-stack/auth/components";

export const Route = createFileRoute("/_auth/sign-in")({
  component: () => <Signin />,
});
