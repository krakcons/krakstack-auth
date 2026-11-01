import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from "effect/http-api";
import { AdminAuthMiddleware } from "@/services/auth/middleware";
import {
  ConfigureProjectWebhook,
  ProjectWebhookEndpoint,
  ProjectWebhookSummary,
  WebhookDeliveries,
  WebhookDeliveriesQuery,
} from "./schema";

export const AdminProjectWebhooksApiGroup = HttpApiGroup.make("projectWebhooks")
  .add(
    HttpApiEndpoint.get("listProjectWebhooks", "/admin/webhooks", {
      success: Schema.Array(ProjectWebhookSummary),
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.get(
      "listProjectWebhookDeliveries",
      "/admin/projects/:projectId/webhook/deliveries",
      {
        params: { projectId: Schema.NonEmptyString },
        query: WebhookDeliveriesQuery,
        success: WebhookDeliveries,
        error: [
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.NotFound,
          HttpApiError.InternalServerError,
        ],
      },
    ),
  )
  .add(
    HttpApiEndpoint.get(
      "getProjectWebhook",
      "/admin/projects/:projectId/webhook",
      {
        params: { projectId: Schema.NonEmptyString },
        success: Schema.NullOr(ProjectWebhookEndpoint),
        error: [
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.InternalServerError,
        ],
      },
    ),
  )
  .add(
    HttpApiEndpoint.put(
      "configureProjectWebhook",
      "/admin/projects/:projectId/webhook",
      {
        params: { projectId: Schema.NonEmptyString },
        payload: ConfigureProjectWebhook,
        success: ProjectWebhookEndpoint,
        error: [
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.BadRequest,
          HttpApiError.NotFound,
          HttpApiError.InternalServerError,
        ],
      },
    ),
  )
  .middleware(AdminAuthMiddleware);
