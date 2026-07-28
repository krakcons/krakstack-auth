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
        const betterAuth = yield* BetterAuthRequest;
        const { parentId, ...data } = payload;
        const updated = yield* Effect.promise(() =>
          betterAuth.api.updateOrganization({
            body: {
              organizationId: id,
              data: { ...data, ...(parentId ? { parentId } : {}) },
            },
            headers: betterAuth.headers,
          }),
        );

        if (parentId !== null || !updated) return updated;

        const database = yield* DB;
        yield* database
          .update(organization)
          .set({ parentId: null })
          .where(eq(organization.id, id));

        return { ...updated, parentId: null };
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
