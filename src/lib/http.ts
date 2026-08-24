import { Effect, Option, Schema } from "effect";
import { HttpEffect, HttpServerResponse } from "effect/unstable/http";

import { corsMiddleware, type CorsOptions } from "@/lib/cors";

export const httpJson = (body: typeof Schema.Unknown.Type, status = 200) =>
  HttpServerResponse.jsonUnsafe(body, { status });

const readStringField = async (request: Request, field: string) => {
  const body = await request.json();
  const decoded = Schema.decodeUnknownOption(
    Schema.Record(Schema.String, Schema.Unknown),
  )(body);
  if (Option.isNone(decoded)) return null;

  return Option.getOrNull(
    Schema.decodeUnknownOption(Schema.String)(decoded.value[field]),
  );
};

export const readStringFieldEffect = (request: Request, field: string) =>
  Effect.tryPromise({
    try: () => readStringField(request, field),
    catch: (error) => error,
  });

export const effectifyWebHandler =
  (handler: (request: Request) => Response | Promise<Response>) =>
  (request: Request) =>
    Effect.tryPromise({
      try: () => Promise.resolve(handler(request)),
      catch: (error) => error,
    }).pipe(Effect.map(HttpServerResponse.fromWeb));

const catchHttpFailure = <E>(
  effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E>,
) =>
  Effect.catchCause(effect, (cause) =>
    Effect.sync(() => {
      console.error("[HTTP] handler failed:", cause);
      return httpJson({ error: "Internal server error" }, 500);
    }),
  );

export const runHttpResponse = <E>(
  request: Request,
  effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E>,
  corsOptions?: CorsOptions,
) =>
  corsMiddleware(
    HttpEffect.toWebHandler(catchHttpFailure(effect)),
    corsOptions,
  )(request);
