import { createFileRoute } from "@tanstack/react-router";
import { VerifyEmail } from "@krak-stack/auth";
import { Option, Schema } from "effect";

import { authClient } from "@/services/auth/client";

export const Route = createFileRoute("/_auth/verify-email")({
  validateSearch: (search) => ({
    email: Option.getOrElse(
      Schema.decodeUnknownOption(Schema.String)(search.email),
      () => "",
    ),
  }),
  component: () => <VerifyEmail authClient={authClient} />,
});
