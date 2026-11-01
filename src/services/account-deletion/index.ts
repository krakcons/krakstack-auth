import { createHash } from "node:crypto";
import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { Events } from "@krak-stack/registry/events";
import { ProjectWebhooks } from "@/services/webhooks";
import {
  AccountDeletionBlocked,
  BlockingOrganization,
  DeletionActor,
  DeletionProject,
  deletionEvent,
  organizationDeletionEvent,
  personalOrganizationDeletionEvent,
} from "./schema";

export class AccountDeletions extends Context.Service<AccountDeletions>()(
  "auth/AccountDeletions",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const events = yield* Events;
      const webhooks = yield* ProjectWebhooks;
      const projects = SqlSchema.findAll({
        Request: Schema.String,
        Result: DeletionProject,
        execute: (
          userId,
        ) => sql`SELECT DISTINCT p.id, p.name FROM project p WHERE p.id IN (
        SELECT project_id FROM project_user WHERE user_id = ${userId}
        UNION SELECT po.project_id FROM project_organization po JOIN member m ON m.organization_id = po.organization_id WHERE m.user_id = ${userId}
      ) ORDER BY p.name, p.id`,
      });
      const organizations = SqlSchema.findAll({
        Request: Schema.String,
        Result: BlockingOrganization,
        execute: (
          userId,
        ) => sql`SELECT o.id, o.name, (o.user_id IS NOT NULL) AS personal FROM organization o
        WHERE (o.user_id = ${userId} OR EXISTS (SELECT 1 FROM member mine WHERE mine.organization_id = o.id AND mine.user_id = ${userId} AND 'owner' = ANY(string_to_array(mine.role, ','))))
        AND (o.user_id IS DISTINCT FROM ${userId} OR EXISTS (SELECT 1 FROM member other WHERE other.organization_id = o.id AND other.user_id <> ${userId})) ORDER BY o.name`,
      });
      const plan = Effect.fn("AccountDeletions.plan")(function* ({
        userId,
      }: {
        userId: string;
      }) {
        const connected = yield* projects(userId);
        const [actor] = yield* SqlSchema.findAll({
          Request: Schema.String,
          Result: DeletionActor,
          execute: (id) => sql`SELECT id, role FROM "user" WHERE id = ${id}`,
        })(userId);
        return {
          projects: yield* Effect.forEach(connected, (project) =>
            webhooks.endpoint({ projectId: project.id }).pipe(
              Effect.map((configured) => ({
                ...project,
                ready:
                  configured?.enabled === true &&
                  (configured.events === null ||
                    configured.events.includes("user.deletion_requested")),
              })),
            ),
          ),
          organizations: yield* organizations(userId),
          adminAccount:
            actor?.role?.split(",").some((role) => role.trim() === "admin") ??
            false,
        };
      });
      const captureOrganization = Effect.fn(
        "AccountDeletions.captureOrganization",
      )(function* (input: { organizationId: string; requestId: string }) {
        const requestId = createHash("sha256")
          .update(`${input.requestId}:${input.organizationId}`)
          .digest("hex");
        const connected = yield* SqlSchema.findAll({
          Request: Schema.String,
          Result: DeletionProject,
          execute: (id) =>
            sql`SELECT p.id, p.name FROM project p JOIN project_organization po ON po.project_id = p.id WHERE po.organization_id = ${id}`,
        })(input.organizationId);
        for (const project of connected) {
          const eventId = createHash("sha256")
            .update(`${requestId}:${project.id}`)
            .digest("hex");
          yield* events.track({
            name: organizationDeletionEvent,
            eventId,
            identity: { organizationId: project.id },
            // Each organization/project publication has a distinct idempotency key.
            properties: {
              eventId,
              data: {
                projectId: project.id,
                organizationId: input.organizationId,
                scope: "organization",
              },
            },
          });
        }
      }, sql.withTransaction);
      const capture = Effect.fn("AccountDeletions.capture")(function* (input: {
        userId: string;
        requestId: string;
      }) {
        // Persist routing IDs before Better Auth removes project_user/member rows.
        // The subscriber verifies that the user is actually gone before cleanup.
        for (const project of yield* projects(input.userId)) {
          const eventId = `${input.requestId}:${project.id}`;
          yield* events
            .track({
              name: deletionEvent,
              eventId,
              identity: { organizationId: project.id },
              properties: {
                eventId,
                data: {
                  projectId: project.id,
                  userId: input.userId,
                  scope: "account",
                },
              },
            })
            .pipe(Effect.annotateLogs({ "organization.id": project.id }));
        }
        const personal = yield* SqlSchema.findAll({
          Request: Schema.String,
          Result: DeletionProject,
          execute: (id) =>
            sql`SELECT id, name FROM organization WHERE user_id = ${id}`,
        })(input.userId);
        for (const organization of personal) {
          const others =
            yield* sql`SELECT id FROM member WHERE organization_id = ${organization.id} AND user_id <> ${input.userId}`;
          if (others.length)
            return yield* new AccountDeletionBlocked({
              reason: "organization_owner",
            });
          yield* captureOrganization({
            organizationId: organization.id,
            requestId: input.requestId,
          });
          // Durable cleanup waits for the user deletion to commit. Never delete
          // personal data in a before-hook if Better Auth might still fail.
          yield* events.track({
            name: personalOrganizationDeletionEvent,
            eventId: `${input.requestId}:${organization.id}`,
            identity: { organizationId: organization.id },
            properties: {
              userId: input.userId,
              organizationId: organization.id,
            },
          });
        }
        yield* sql`DELETE FROM apikey WHERE config_id = 'user' AND reference_id = ${input.userId}`;
        const [identity] = yield* SqlSchema.findAll({
          Request: Schema.String,
          Result: Schema.Struct({ email: Schema.String }).annotate({
            identifier: "DeletionEmail",
          }),
          execute: (id) => sql`SELECT email FROM "user" WHERE id = ${id}`,
        })(input.userId);
        if (identity)
          yield* sql`DELETE FROM verification WHERE value = ${input.userId} OR identifier IN (
        ${identity.email}, ${`sign-in-otp-${identity.email}`}, ${`email-verification-otp-${identity.email}`}, ${`forget-password-otp-${identity.email}`}
      )`;
      }, sql.withTransaction);
      const prepare = Effect.fn("AccountDeletions.prepare")(function* (input: {
        userId: string;
        requestId: string;
        impersonating: boolean;
      }) {
        if (input.impersonating)
          return yield* new AccountDeletionBlocked({ reason: "impersonation" });
        const review = yield* plan(input);
        // Admins must first transfer their role; this also prevents concurrent
        // self-deletions from removing every platform administrator.
        if (review.adminAccount)
          return yield* new AccountDeletionBlocked({ reason: "admin_account" });
        if (review.organizations.length)
          return yield* new AccountDeletionBlocked({
            reason: "organization_owner",
          });
        yield* capture(input);
      });
      return { plan, capture, captureOrganization, prepare };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
