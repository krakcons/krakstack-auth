import { Context, Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/unstable/http";

import { authForRequest } from "@/services/auth/config";

import type {
  CreateOrganizationPayload,
  UpdateOrganizationPayload,
} from "./schema";

export class Organizations extends Context.Service<Organizations>()(
  "Organizations",
  {
    make: Effect.sync(() => {
      const toWebRequest = (request: HttpServerRequest.HttpServerRequest) =>
        HttpServerRequest.toWeb(request);

      const list = Effect.fn("Organizations.list")(function* ({
        request,
      }: {
        request: HttpServerRequest.HttpServerRequest;
      }) {
        const webRequest = yield* toWebRequest(request);
        return yield* Effect.promise(async () =>
          (await authForRequest(webRequest)).api.listOrganizations({
            headers: webRequest.headers,
          }),
        );
      });

      const create = Effect.fn("Organizations.create")(function* ({
        request,
        payload,
      }: {
        request: HttpServerRequest.HttpServerRequest;
        payload: CreateOrganizationPayload;
      }) {
        const webRequest = yield* toWebRequest(request);
        return yield* Effect.promise(async () =>
          (await authForRequest(webRequest)).api.createOrganization({
            body: payload,
            headers: webRequest.headers,
          }),
        );
      });

      const update = Effect.fn("Organizations.update")(function* ({
        request,
        id,
        payload,
      }: {
        request: HttpServerRequest.HttpServerRequest;
        id: string;
        payload: UpdateOrganizationPayload;
      }) {
        const webRequest = yield* toWebRequest(request);
        return yield* Effect.promise(async () =>
          (await authForRequest(webRequest)).api.updateOrganization({
            body: { organizationId: id, data: payload },
            headers: webRequest.headers,
          }),
        );
      });

      const _delete = Effect.fn("Organizations.delete")(function* ({
        request,
        id,
      }: {
        request: HttpServerRequest.HttpServerRequest;
        id: string;
      }) {
        const webRequest = yield* toWebRequest(request);
        return yield* Effect.promise(async () =>
          (await authForRequest(webRequest)).api.deleteOrganization({
            body: { organizationId: id },
            headers: webRequest.headers,
          }),
        );
      });

      return { list, create, update, delete: _delete };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
