import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
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
        return yield* Effect.promise(() =>
          betterAuth.api.createOrganization({
            body: parentId === undefined ? data : { ...data, parentId },
            headers: betterAuth.headers,
          }),
        );
      });

      const update = Effect.fn("Organizations.update")(function* ({
        id,
        payload,
      }: {
        id: string;
        payload: AdminUpdateOrganizationPayload;
      }) {
        const sql = yield* SqlClient.SqlClient;
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
        if (payload.parentId !== undefined) updates.parentId = payload.parentId;

        const [updated] = yield* SqlSchema.findAll({
          Request: Schema.String,
          Result: OrganizationRow,
          execute: (id) =>
            Object.keys(updates).length
              ? sql`UPDATE organization SET ${sql.update(updates)} WHERE id = ${id} RETURNING *`
              : sql`SELECT * FROM organization WHERE id = ${id} LIMIT 1`,
        })(id);

        return updated ?? null;
      });

      const _delete = Effect.fn("Organizations.delete")(function* ({
        id,
      }: {
        id: string;
      }) {
        const betterAuth = yield* BetterAuthRequest;
        return yield* Effect.promise(() =>
          betterAuth.api.deleteOrganization({
            body: { organizationId: id },
            headers: betterAuth.headers,
          }),
        );
      });

      return { list, create, update, delete: _delete };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
