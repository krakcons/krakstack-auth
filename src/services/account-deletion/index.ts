import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { Events } from "@krak-stack/registry/events";
import { ProjectWebhooks } from "@/services/webhooks";
import { AccountDeletionBlocked, DeletionActor, DeletionProject, deletionEvent } from "./schema";

export class AccountDeletions extends Context.Service<AccountDeletions>()("auth/AccountDeletions", {
  make: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const events = yield* Events;
    const webhooks = yield* ProjectWebhooks;
    const projects = SqlSchema.findAll({
      Request: Schema.String, Result: DeletionProject,
      execute: (userId) => sql`SELECT DISTINCT p.id, p.name FROM project p WHERE p.id IN (
        SELECT project_id FROM project_user WHERE user_id = ${userId}
        UNION SELECT po.project_id FROM project_organization po JOIN member m ON m.organization_id = po.organization_id WHERE m.user_id = ${userId}
      ) ORDER BY p.name, p.id`,
    });
    const organizations = SqlSchema.findAll({
      Request: Schema.String, Result: DeletionProject,
      execute: (userId) => sql`SELECT o.id, o.name FROM member mine JOIN organization o ON o.id = mine.organization_id
        WHERE mine.user_id = ${userId} AND 'owner' = ANY(string_to_array(mine.role, ',')) ORDER BY o.name`,
    });
    const plan = Effect.fn("AccountDeletions.plan")(function* ({ userId }: { userId: string }) {
      const connected = yield* projects(userId);
      const [actor] = yield* SqlSchema.findAll({ Request: Schema.String, Result: DeletionActor, execute: (id) => sql`SELECT id, role FROM "user" WHERE id = ${id}` })(userId);
      return {
        projects: yield* Effect.forEach(connected, (project) => webhooks.endpoint({ projectId: project.id }).pipe(
          Effect.map((configured) => ({ ...project, ready: configured?.enabled === true && (configured.events === null || configured.events.includes("user.deletion_requested")) })),
        )),
        organizations: yield* organizations(userId),
        adminAccount: actor?.role?.split(",").some((role) => role.trim() === "admin") ?? false,
      };
    });
    const capture = Effect.fn("AccountDeletions.capture")(function* (input: { userId: string; requestId: string }) {
      // Persist routing IDs before Better Auth removes project_user/member rows.
      // The subscriber verifies that the user is actually gone before cleanup.
      for (const project of yield* projects(input.userId)) {
        const eventId = `${input.requestId}:${project.id}`;
        yield* events.track({
          name: deletionEvent, eventId,
          identity: { organizationId: project.id },
          properties: { eventId, data: { version: 1, requestId: input.requestId, projectId: project.id, userId: input.userId, scope: "account" } },
        }).pipe(Effect.annotateLogs({ "organization.id": project.id }));
      }
      yield* sql`DELETE FROM apikey WHERE config_id = 'user' AND reference_id = ${input.userId}`;
      const [identity] = yield* SqlSchema.findAll({
        Request: Schema.String,
        Result: Schema.Struct({ email: Schema.String }).annotate({ identifier: "DeletionEmail" }),
        execute: (id) => sql`SELECT email FROM "user" WHERE id = ${id}`,
      })(input.userId);
      if (identity) yield* sql`DELETE FROM verification WHERE value = ${input.userId} OR identifier IN (
        ${identity.email}, ${`sign-in-otp-${identity.email}`}, ${`email-verification-otp-${identity.email}`}, ${`forget-password-otp-${identity.email}`}
      )`;
    }, sql.withTransaction);
    const prepare = Effect.fn("AccountDeletions.prepare")(function* (input: { userId: string; requestId: string; impersonating: boolean }) {
      if (input.impersonating) return yield* new AccountDeletionBlocked({ reason: "impersonation" });
      const review = yield* plan(input);
      // Admins must first transfer their role; this also prevents concurrent
      // self-deletions from removing every platform administrator.
      if (review.adminAccount) return yield* new AccountDeletionBlocked({ reason: "admin_account" });
      if (review.organizations.length) return yield* new AccountDeletionBlocked({ reason: "organization_owner" });
      yield* capture(input);
    });
    return { plan, capture, prepare };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
