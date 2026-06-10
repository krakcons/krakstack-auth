import { Context, Effect, Layer } from "effect";
import type { Headers } from "effect/unstable/http/Headers";

import { auth } from "@/services/auth/config";

import type {
  CreateOrganizationPayload,
  UpdateOrganizationPayload,
} from "./schema";

export class Organizations extends Context.Service<Organizations>()(
  "Organizations",
  {
    make: Effect.sync(() => {
      const list = Effect.fn("Organizations.list")(function* ({
        headers,
      }: {
        headers: Headers;
      }) {
        return yield* Effect.promise(() =>
          auth.api.listOrganizations({ headers }),
        );
      });

      const create = Effect.fn("Organizations.create")(function* ({
        headers,
        payload,
      }: {
        headers: Headers;
        payload: CreateOrganizationPayload;
      }) {
        return yield* Effect.promise(() =>
          auth.api.createOrganization({ body: payload, headers }),
        );
      });

      const update = Effect.fn("Organizations.update")(function* ({
        headers,
        id,
        payload,
      }: {
        headers: Headers;
        id: string;
        payload: UpdateOrganizationPayload;
      }) {
        return yield* Effect.promise(() =>
          auth.api.updateOrganization({
            body: { organizationId: id, data: payload },
            headers,
          }),
        );
      });

      const _delete = Effect.fn("Organizations.delete")(function* ({
        headers,
        id,
      }: {
        headers: Headers;
        id: string;
      }) {
        return yield* Effect.promise(() =>
          auth.api.deleteOrganization({
            body: { organizationId: id },
            headers,
          }),
        );
      });

      return { list, create, update, delete: _delete };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
