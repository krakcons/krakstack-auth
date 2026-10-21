import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { Events } from "@krak-stack/registry/events";
import { HttpApiError } from "effect/http-api";
import { OrganizationRow } from "@/db/schema";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import type { OrganizationSqlUpdate } from "./schema";

import type {
  AdminCreateOrganizationPayload,
  AdminUpdateOrganizationPayload,
} from "@krak-stack/auth/admin";

export class Organizations extends Context.Service<Organizations>()(
  "Organizations",
  {
    make: Effect.sync(() => {
      const list = Effect.fn("Organizations.list")(function* () {
        const betterAuth = yield* BetterAuthRequest;
        return yield* Effect.promise(() =>
          betterAuth.api.listOrganizations({ headers: betterAuth.headers }),
        );
      });

      const create = Effect.fn("Organizations.create")(function* ({
        payload,
      }: {
        payload: AdminCreateOrganizationPayload;
      }) {
        const betterAuth = yield* BetterAuthRequest;
        const { parentId, ...data } = payload;
        const events = yield* Events;
        const operationId = crypto.randomUUID();
        yield* Effect.logDebug("Organization creation started").pipe(
          Effect.annotateLogs({ operationId }),
        );
        // Better Auth uses its own connection; completion cannot be made atomic
        // with this application's Events transaction.
        const result = yield* Effect.tryPromise({
          try: () =>
            betterAuth.api.createOrganization({
              body: parentId === undefined ? data : { ...data, parentId },
              headers: betterAuth.headers,
            }),
          catch: () => new HttpApiError.InternalServerError({}),
        }).pipe(Effect.result);
        if (result._tag === "Failure") {
          yield* Effect.logDebug("Organization creation failed").pipe(
            Effect.annotateLogs({ operationId }),
          );
          return yield* result.failure;
        }
        if (result.success)
          yield* events.track({
            name: "organization.created",
            category: "audit",
            target: {
              id: result.success.id,
              name: result.success.id,
              type: "organization",
            },
            properties: { operationId },
          });
        return result.success;
      });

      const update = Effect.fn("Organizations.update")(function* ({
        id,
        payload,
      }: {
        id: string;
        payload: AdminUpdateOrganizationPayload;
      }) {
        const sql = yield* SqlClient.SqlClient;
        return yield* Effect.gen(function* () {
          if (payload.parentId) {
            if (payload.parentId === id) {
              return yield* Effect.fail(
                new Error("An organization cannot be its own parent"),
              );
            }

            const [parent] = yield* SqlSchema.findAll({
              Request: Schema.String,
              Result: OrganizationRow,
              execute: (id) =>
                sql`SELECT * FROM organization WHERE id = ${id} LIMIT 1`,
            })(payload.parentId);
            if (!parent || parent.parentId) {
              return yield* Effect.fail(
                new Error("Parent organization must be a root organization"),
              );
            }
          }

          const updates: OrganizationSqlUpdate = {};
          if (payload.name !== undefined) updates.name = payload.name;
          if (payload.slug !== undefined) updates.slug = payload.slug;
          if (payload.logo !== undefined) updates.logo = payload.logo;
          if (payload.parentId !== undefined)
            updates.parentId = payload.parentId;

          const [updated] = yield* SqlSchema.findAll({
            Request: Schema.String,
            Result: OrganizationRow,
            execute: (id) =>
              Object.keys(updates).length
                ? sql`UPDATE organization SET ${sql.update(updates)} WHERE id = ${id} RETURNING *`
                : sql`SELECT * FROM organization WHERE id = ${id} LIMIT 1`,
          })(id);

          if (updated && Object.keys(updates).length)
            yield* (yield* Events).track({
              name: "organization.updated",
              category: "audit",
              target: { id, name: id, type: "organization" },
              properties: { changedFields: Object.keys(updates) },
            });
          return updated ?? null;
        }).pipe(sql.withTransaction);
      });

      const _delete = Effect.fn("Organizations.delete")(function* ({
        id,
      }: {
        id: string;
      }) {
        const betterAuth = yield* BetterAuthRequest;
        const events = yield* Events;
        const operationId = crypto.randomUUID();
        yield* Effect.logDebug("Organization deletion started").pipe(
          Effect.annotateLogs({ operationId }),
        );
        const result = yield* Effect.tryPromise({
          try: () =>
            betterAuth.api.deleteOrganization({
              body: { organizationId: id },
              headers: betterAuth.headers,
            }),
          catch: () => new HttpApiError.InternalServerError({}),
        }).pipe(Effect.result);
        if (result._tag === "Failure") {
          yield* Effect.logDebug("Organization deletion failed").pipe(
            Effect.annotateLogs({ operationId }),
          );
          return yield* result.failure;
        }
        if (result.success)
          yield* events.track({
            name: "organization.deleted",
            category: "audit",
            target: { id, name: id, type: "organization" },
            properties: { operationId },
          });
        return result.success;
      });

      return { list, create, update, delete: _delete };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
