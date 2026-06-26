import { HttpApiError, HttpApiMiddleware } from "effect/unstable/httpapi";

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
    error: [HttpApiError.Unauthorized, HttpApiError.InternalServerError],
  },
) {}
