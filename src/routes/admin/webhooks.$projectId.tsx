import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/webhooks/$projectId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/admin/projects/$projectId/webhooks", params });
  },
});
