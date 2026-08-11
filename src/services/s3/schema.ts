import { Schema } from "effect";
import { Multipart } from "effect/unstable/http";
import { HttpApiSchema } from "effect/unstable/httpapi";

export const ImageUploadPayload = Schema.Struct({
  file: Multipart.SingleFileSchema,
}).annotate({
  identifier: "ImageUploadPayload",
  title: "Image upload payload",
  description: "Multipart form data payload containing a single image file.",
});

export const ImageUploadMultipartPayload = ImageUploadPayload.pipe(
  HttpApiSchema.asMultipartStream(),
);

export const UploadedAsset = Schema.Struct({
  url: Schema.String,
}).annotate({
  identifier: "UploadedAsset",
  title: "Uploaded asset",
  description: "Stable public asset URL for an uploaded file.",
  examples: [
    {
      url: "https://auth.example.com/api/auth/assets/logos/organizations/logo.png",
    },
  ],
});

export type ImageUploadPayload = typeof ImageUploadPayload.Type;
