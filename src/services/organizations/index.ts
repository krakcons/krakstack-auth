import { Context, Effect, Layer } from "effect";

import { BetterAuthRequest } from "@/services/auth/better-auth-request";

import type {
  CreateOrganizationPayload,
  UpdateOrganizationPayload,
} from "./schema";

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
        payload: CreateOrganizationPayload;
      }) {
        const betterAuth = yield* BetterAuthRequest;
        return yield* Effect.promise(() =>
          betterAuth.api.createOrganization({
            body: payload,
            headers: betterAuth.headers,
          }),
        );
      });

      const update = Effect.fn("Organizations.update")(function* ({
        id,
        payload,
      }: {
        id: string;
        payload: UpdateOrganizationPayload;
      }) {
        const betterAuth = yield* BetterAuthRequest;
        return yield* Effect.promise(() =>
          betterAuth.api.updateOrganization({
            body: { organizationId: id, data: payload },
            headers: betterAuth.headers,
          }),
        );
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
