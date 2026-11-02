import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/oauth/clients")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/projects" });
  },
});
