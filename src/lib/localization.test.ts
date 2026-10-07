import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpClientRequest, HttpServer } from "effect/http";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiTest,
} from "effect/http-api";

import {
  LocaleContext,
  LocaleSchema,
  LocaleMiddleware,
  LocaleMiddlewareLive,
  localize,
} from "./localization";

describe("LocaleMiddleware", () => {
  const endpoint = HttpApiEndpoint.get("locale", "/locale", {
    success: LocaleSchema,
  });
  const group = HttpApiGroup.make("locale").add(endpoint);
  const api = HttpApi.make("LocaleTestApi")
    .add(group)
    .middleware(LocaleMiddleware);
  const handlers = HttpApiBuilder.group(api, "locale", (handlers) =>
    handlers.handle("locale", () =>
      Effect.gen(function* () {
        return (yield* LocaleContext).locale;
      }),
    ),
  ).pipe(Layer.provideMerge(LocaleMiddlewareLive));

  it.effect("provides the request locale to the handler", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(api, ["locale"]);
      expect(yield* client.locale.locale()).toBe("fr");
    }).pipe(
      Effect.provide(
        HttpApiMiddleware.layerClient(LocaleMiddleware, ({ next, request }) =>
          next(HttpClientRequest.setHeader(request, "accept-language", "fr")),
        ),
      ),
      Effect.provide(Layer.mergeAll(handlers, HttpServer.layerServices)),
    ),
  );
});

describe("localize", () => {
  it("returns the requested locale when no translation is available", () => {
    expect(
      localize(
        { locale: "fr", fallbackLocale: "none" },
        { id: "organization-1", translations: [] },
      ),
    ).toEqual({ id: "organization-1", locale: "fr" });
  });
});
