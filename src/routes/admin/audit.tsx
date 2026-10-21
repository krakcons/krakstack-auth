import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "@effect/atom-react";
import {
  activeAuthOrganizationAtom,
  assetUrl,
  useKrakstackAuth,
} from "@krak-stack/auth/components";
import { AsyncResult } from "effect/reactivity";
import { QueryStandard } from "@krak-stack/registry/query";
import {
  AuditLogTable,
  type AuditActor,
} from "@krak-stack/registry/events/client";
import { SidebarPageHeader } from "@krak-stack/registry/sidebar-layout";
import { auditLogAtom } from "@/services/audit/client/atom";
import { m } from "@/paraglide/messages";

function AuditPage() {
  const auth = useKrakstackAuth();
  const organization = AsyncResult.getOrElse(
    useAtomValue(
      activeAuthOrganizationAtom(auth?.baseUrl)(
        import.meta.env.VITE_KRAKSTACK_AUTH_ORGANIZATION_ID ?? null,
      ),
    ),
    () => null,
  );
  const actors: AuditActor[] = organization
    ? [
        {
          type: "organization",
          id: organization.id,
          label: organization.name,
          description: organization.id,
          imageSrc: assetUrl(organization.logo, auth?.baseUrl),
        },
        ...organization.members.map(
          (member): AuditActor => ({
            type: "user",
            id: member.userId,
            label: member.user.name,
            description: member.userId,
            imageSrc: assetUrl(member.user.image, auth?.baseUrl),
          }),
        ),
      ]
    : [];
  const state = Route.useSearch();
  const navigate = Route.useNavigate();
  const result = useAtomValue(auditLogAtom(state));
  const page = AsyncResult.getOrElse(result, () => undefined);
  return (
    <>
      <SidebarPageHeader
        title={m.audit_history_title()}
        description={m.audit_description()}
      />
      <AuditLogTable
        actors={actors}
        messages={{
          en: { title: m.audit_history_title({}, { locale: "en" }) },
          fr: { title: m.audit_history_title({}, { locale: "fr" }) },
        }}
        entries={page?.data ?? []}
        rowCount={page?.meta.total ?? 0}
        state={state}
        onStateChange={(search) => {
          void navigate({ replace: true, search });
        }}
        loading={AsyncResult.isInitial(result) || AsyncResult.isWaiting(result)}
        error={AsyncResult.isFailure(result) ? m.audit_load_error() : undefined}
      />
    </>
  );
}

export const Route = createFileRoute("/admin/audit")({
  validateSearch: QueryStandard,
  component: AuditPage,
});
