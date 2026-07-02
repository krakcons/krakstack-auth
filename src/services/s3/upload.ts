import { Array as Arr, Effect, Stream } from "effect";
import { Multipart } from "effect/unstable/http";

import { S3Service } from "@/services/s3";
import { s3AssetUrl } from "@/services/s3/asset-url";

const safeFileName = (name: string, fallback: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;

export const uploadImageFromMultipart = <BadRequest, InternalServerError>({
  payload,
  prefix,
  fallbackFileName,
  badRequest,
  internalServerError,
}: {
  payload: Stream.Stream<Multipart.Part, unknown>;
  prefix: string;
  fallbackFileName: string;
  badRequest: (message: string) => BadRequest;
  internalServerError: (error: unknown) => InternalServerError;
}) =>
  Effect.gen(function* () {
    const [upload] = yield* payload.pipe(
      Stream.filter(Multipart.isFile),
      Stream.mapEffect((file) =>
        file.contentEffect.pipe(Effect.map((content) => ({ file, content }))),
      ),
      Stream.runCollect,
      Effect.map(Arr.fromIterable),
      Effect.mapError(() => badRequest("Could not read image upload")),
    );

    if (!upload) {
      return yield* Effect.fail(badRequest("Image upload file is required"));
    }

    if (!upload.file.contentType.startsWith("image/")) {
      return yield* Effect.fail(badRequest("Only image uploads are supported"));
    }

    const s3 = yield* S3Service;
    const key = `${prefix.replace(/\/+$/g, "")}/${crypto.randomUUID()}-${safeFileName(upload.file.name, fallbackFileName)}`;
    yield* s3
      .write(key, upload.content, { type: upload.file.contentType })
      .pipe(Effect.mapError(internalServerError));

    return s3AssetUrl(key);
  });
