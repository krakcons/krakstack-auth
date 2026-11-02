import { Option, Schema } from "effect";
import { WebhookDeliveriesQuery } from "@krak-stack/registry/webhooks/schema";
import {
  isPublicWebhookUrlString,
  isLoopbackWebhookUrl,
} from "@krak-stack/registry/webhooks/url";

export {
  WebhookDeliveries,
  WebhookDeliveriesQuery,
  WebhookDelivery,
} from "@krak-stack/registry/webhooks/schema";

export const projectWebhookName = "AuthProjectWebhooksV1";
export const legacyDeletionWebhookName = "AuthAccountDeletionV1";
export const ProjectWebhookEndpoint = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  secret: Schema.String,
  enabled: Schema.Boolean,
}).annotate({ identifier: "ProjectWebhookEndpoint" });
export const allowDevelopmentWebhookLoopback =
  import.meta.env.DEV && import.meta.env.MODE === "development";

export const configureProjectWebhookSchema = (allowLoopback: boolean) =>
  Schema.Struct({
    url: Schema.String.check(
      Schema.makeFilter(
        (value) => {
          const parsed = Schema.decodeOption(Schema.URLFromString)(value);
          return (
            Option.isSome(parsed) &&
            ((parsed.value.protocol === "https:" &&
              isPublicWebhookUrlString(value)) ||
              (allowLoopback && isLoopbackWebhookUrl(parsed.value)))
          );
        },
        {
          expected:
            "a public HTTPS URL, or a loopback URL in local development",
        },
      ),
    ),
  }).annotate({ identifier: "ConfigureProjectWebhook" });

export const ConfigureProjectWebhook = configureProjectWebhookSchema(
  allowDevelopmentWebhookLoopback,
);

export const ProjectWebhookSummary = Schema.Struct({
  projectId: Schema.String,
  projectName: Schema.String,
  url: Schema.NullOr(Schema.String),
  enabled: Schema.NullOr(Schema.Boolean),
}).annotate({ identifier: "ProjectWebhookSummary" });

export const WebhooksPageSearch = Schema.Struct({
  ...WebhookDeliveriesQuery.fields,
  tab: Schema.optional(Schema.Literals(["activity", "settings"])),
}).annotate({ identifier: "WebhooksPageSearch" });
