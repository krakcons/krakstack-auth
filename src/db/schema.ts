import { Option, Schema, SchemaGetter } from "effect";
import { decodeUserMetadata, UserMetadata } from "@krak-stack/auth/schema";

// Persisted contacts can predate the current write schema. Normalize them with
// the SDK's compatibility decoder without weakening validation for new writes.
const StoredUserMetadata = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.NullOr(UserMetadata), {
    decode: SchemaGetter.transform((value) =>
      value === null
        ? null
        : decodeUserMetadata(
            Option.getOrNull(
              Schema.decodeUnknownOption(
                Schema.Record(Schema.String, Schema.Unknown),
              )(value),
            ),
          ),
    ),
    encode: SchemaGetter.transform((value) => value),
  }),
).annotate({ identifier: "StoredUserMetadata" });

export const ProjectRow = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  logo: Schema.NullOr(Schema.String),
  data: Schema.Unknown,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}).annotate({ identifier: "ProjectRow" });

export const OrganizationRow = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  logo: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(Schema.String),
  userId: Schema.NullOr(Schema.String),
  parentId: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
}).annotate({ identifier: "OrganizationRow" });

export const UserRow = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String),
  metadata: StoredUserMetadata,
  role: Schema.NullOr(Schema.String),
  banned: Schema.NullOr(Schema.Boolean),
  banReason: Schema.NullOr(Schema.String),
  banExpires: Schema.NullOr(Schema.Date),
  isAnonymous: Schema.NullOr(Schema.Boolean),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}).annotate({ identifier: "UserRow" });

export const DomainRow = Schema.Struct({
  id: Schema.String,
  hostname: Schema.String,
  rootHostname: Schema.String,
  projectId: Schema.NullOr(Schema.String),
  organizationId: Schema.NullOr(Schema.String),
  hostnameId: Schema.String,
  managed: Schema.Boolean,
  active: Schema.Boolean,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}).annotate({ identifier: "DomainRow" });

export const OAuthClientRow = Schema.Struct({
  clientId: Schema.String,
  name: Schema.NullOr(Schema.String),
  icon: Schema.NullOr(Schema.String),
  projectId: Schema.NullOr(Schema.String),
  disabled: Schema.NullOr(Schema.Boolean),
}).annotate({ identifier: "OAuthClientRow" });

export const ApiKeyRow = Schema.Struct({
  id: Schema.String,
  configId: Schema.String,
  name: Schema.NullOr(Schema.String),
  start: Schema.NullOr(Schema.String),
  referenceId: Schema.String,
  prefix: Schema.NullOr(Schema.String),
  enabled: Schema.NullOr(Schema.Boolean),
  rateLimitEnabled: Schema.NullOr(Schema.Boolean),
  rateLimitTimeWindow: Schema.NullOr(Schema.Number),
  rateLimitMax: Schema.NullOr(Schema.Number),
  requestCount: Schema.NullOr(Schema.Number),
  remaining: Schema.NullOr(Schema.Number),
  lastRequest: Schema.NullOr(Schema.Date),
  expiresAt: Schema.NullOr(Schema.Date),
  permissions: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}).annotate({ identifier: "ApiKeyRow" });

export const IdRow = Schema.Struct({ id: Schema.String }).annotate({
  identifier: "IdRow",
});
export const RoleRow = Schema.Struct({
  role: Schema.NullOr(Schema.String),
}).annotate({ identifier: "RoleRow" });
export const ResourcePreviewRow = Schema.Struct({
  resourceId: Schema.String,
  id: Schema.String,
  name: Schema.String,
  logo: Schema.NullOr(Schema.String),
}).annotate({ identifier: "ResourcePreviewRow" });
