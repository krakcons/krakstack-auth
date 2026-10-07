import { Schema } from "effect";
import { HttpApiError, HttpApiMiddleware } from "effect/http-api";

export class ServiceApiKeyUnauthorized extends Schema.TaggedError<ServiceApiKeyUnauthorized>()(
  "ServiceApiKeyUnauthorized",
  { message: Schema.String },
  { httpApiStatus: 401 },
) {}

export class AdminAuthMiddleware extends HttpApiMiddleware.Service<AdminAuthMiddleware>()(
  "KrakStack/AdminAuthMiddleware",
  {
    error: [
      HttpApiError.Unauthorized,
      HttpApiError.Forbidden,
      HttpApiError.InternalServerError,
    ],
  },
) {}

export class ServiceApiKeyMiddleware extends HttpApiMiddleware.Service<ServiceApiKeyMiddleware>()(
  "KrakStack/ServiceApiKeyMiddleware",
  {
    error: [ServiceApiKeyUnauthorized, HttpApiError.InternalServerError],
  },
) {}
