import { Context, Effect, Layer } from "effect";
import { eq } from "drizzle-orm";

import { organization } from "@/db/schema";
import { DB } from "@/services/database";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";

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
            body: { ...data, ...(parentId ? { parentId } : {}) },
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
        const database = yield* DB;
        if (payload.parentId) {
          if (payload.parentId === id) {
            return yield* Effect.fail(
              new Error("An organization cannot be its own parent"),
            );
          }

          const parent = yield* database.query.organization.findFirst({
            where: { id: payload.parentId },
            columns: { parentId: true },
          });
          if (!parent || parent.parentId) {
            return yield* Effect.fail(
              new Error("Parent organization must be a root organization"),
            );
          }
        }

        const [updated] = yield* database
          .update(organization)
          .set({
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.slug !== undefined ? { slug: payload.slug } : {}),
            ...(payload.logo !== undefined ? { logo: payload.logo } : {}),
            ...(payload.parentId !== undefined
              ? { parentId: payload.parentId }
              : {}),
          })
          .where(eq(organization.id, id))
          .returning();

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
