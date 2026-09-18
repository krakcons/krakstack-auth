import { createFileRoute } from "@tanstack/react-router";
import { Signin } from "@krak-stack/auth/components";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/sign-in")({
  component: () => <Signin otpExpiryDescription={m.sign_in_otp_expiry()} />,
});
