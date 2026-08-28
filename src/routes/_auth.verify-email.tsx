import { createFileRoute } from "@tanstack/react-router";
import { VerifyEmail } from "@krak-stack/auth/components";
import { Option, Schema } from "effect";

export const Route = createFileRoute("/_auth/verify-email")({
  validateSearch: (search) => ({
    email: Option.getOrElse(
      Schema.decodeUnknownOption(Schema.String)(search.email),
      () => "",
    ),
  }),
  component: () => <VerifyEmail />,
});
