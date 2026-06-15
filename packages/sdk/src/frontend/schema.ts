import { Schema } from "effect";

export const FrontendPresignUploadPayload = Schema.Struct({
  fileName: Schema.NonEmptyString,
  contentType: Schema.NonEmptyString,
}).annotate({
  identifier: "FrontendPresignUploadPayload",
  title: "Frontend presign upload payload",
  description:
    "Payload used to request a presigned organization logo upload URL.",
  examples: [{ fileName: "logo.png", contentType: "image/png" }],
});

export const FrontendPresignedUpload = Schema.Struct({
  uploadUrl: Schema.String,
  url: Schema.String,
}).annotate({
  identifier: "FrontendPresignedUpload",
  title: "Frontend presigned upload",
  description: "Presigned upload URL and stable public asset URL.",
});

export type FrontendPresignUploadPayload =
  typeof FrontendPresignUploadPayload.Type;
export type FrontendPresignedUpload = typeof FrontendPresignedUpload.Type;
