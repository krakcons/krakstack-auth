import { SecureRandom } from "effect/crypto";
import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { HttpApiError } from "effect/http-api";
import { Events } from "@krak-stack/registry/events";
import { OAuthClientRow, ProjectRow } from "@/db/schema";
import { sqlLayer } from "@/services/database";
import { BetterAuthRequest } from "@/services/auth/better-auth-request";
import { decodeProjectDataOrEmpty } from "@/services/projects";
import type { ProjectData } from "@/services/projects/schema";

import type {
  CreateOAuthClientPayload,
  UpdateOAuthClientPayload,
} from "./schema";
import { sanitizeThemeCss } from "./theme";

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

const authOptions = (data: ProjectData) => ({
  emailPassword: data.authOptions?.emailPassword ?? true,
  emailOtp: data.authOptions?.emailOtp ?? true,
  google: googleConfigured && (data.authOptions?.google ?? true),
});

const scopesFromString = (value: string | undefined) =>
  value
    ?.split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean).length
    ? value
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
    : ["openid", "profile", "email"];

const RawOAuthClient = Schema.Struct({
  client_id: Schema.optional(Schema.String),
  clientId: Schema.optional(Schema.String),
  client_secret: Schema.optional(Schema.String),
  clientSecret: Schema.optional(Schema.String),
  client_name: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  logo_uri: Schema.optional(Schema.String),
  icon: Schema.optional(Schema.String),
  redirect_uris: Schema.optional(Schema.Array(Schema.String)),
  redirectUris: Schema.optional(Schema.Array(Schema.String)),
  scope: Schema.optional(Schema.String),
  scopes: Schema.optional(Schema.Array(Schema.String)),
  disabled: Schema.optional(Schema.Boolean),
  project_id: Schema.optional(Schema.NullOr(Schema.String)),
  projectId: Schema.optional(Schema.NullOr(Schema.String)),
  metadata: Schema.optional(Schema.NullOr(Schema.Unknown)),
});

const decodeRawOAuthClient = Schema.decodeUnknownSync(RawOAuthClient);

type ProjectSummary = {
  id: string | null;
  name: string | null;
  logo: string | null;
  data: ProjectData;
};

const adminRow = (
  client: typeof Schema.Unknown.Type,
  projectSummary?: ProjectSummary,
) => {
  const decoded = decodeRawOAuthClient(client);
  const clientId = decoded.client_id ?? decoded.clientId;
  if (!clientId) throw new Error("OAuth client response is missing client ID");

  return {
    id: clientId,
    clientId,
    name: decoded.client_name ?? decoded.name ?? null,
    icon: decoded.logo_uri ?? decoded.icon ?? null,
    projectId:
      projectSummary?.id ?? decoded.project_id ?? decoded.projectId ?? null,
    projectName: projectSummary?.name ?? null,
    projectLogo: projectSummary?.logo ?? null,
    redirectUris: Array.from(
      decoded.redirect_uris ?? decoded.redirectUris ?? [],
    ),
    domains: [],
    scope: decoded.scope ?? decoded.scopes?.join(" ") ?? null,
    disabled: decoded.disabled ?? null,
    projectData: projectSummary?.data ?? {},
  };
};

const createdRow = (
  client: typeof Schema.Unknown.Type,
  projectSummary?: ProjectSummary,
) => {
  const decoded = decodeRawOAuthClient(client);

  return {
    ...adminRow(client, projectSummary),
    clientSecret: decoded.client_secret ?? decoded.clientSecret ?? "",
  };
};

const projectSummary = (value: typeof ProjectRow.Type | null) =>
  value
    ? {
        id: value.id,
        name: value.name,
        logo: value.logo ?? null,
        data: decodeProjectDataOrEmpty(value.data),
      }
    : undefined;

export class OAuthClients extends Context.Service<OAuthClients>()(
  "OAuthClients",
  {
    make: Effect.gen(function* () {
      const random = yield* SecureRandom.SecureRandom.pipe(
        Effect.provide(SecureRandom.layerWebCrypto),
      );
      const sql = yield* SqlClient.SqlClient;
      const findProject = SqlSchema.findAll({
        Request: Schema.String,
        Result: ProjectRow,
        execute: (id) => sql`SELECT * FROM project WHERE id = ${id} LIMIT 1`,
      });
      const findClient = SqlSchema.findAll({
        Request: Schema.String,
        Result: Schema.Struct({
          ...OAuthClientRow.fields,
          id: Schema.String,
        }).annotate({ identifier: "StoredOAuthClient" }),
        execute: (clientId) =>
          sql`SELECT * FROM oauth_client WHERE client_id = ${clientId} LIMIT 1`,
      });
      const assignProject = Effect.fn("OAuthClients.assignProject")(function* ({
        clientId,
        projectId,
        operationId,
      }: {
        clientId: string;
        projectId: string | null;
        operationId: string;
      }) {
        const assigned =
          yield* sql`UPDATE oauth_client SET project_id = ${projectId}, metadata = '{}'::jsonb, updated_at = ${new Date()} WHERE client_id = ${clientId} RETURNING id`;
        if (!assigned.length) return yield* new HttpApiError.NotFound({});
        const [stored] = yield* findClient(clientId);
        if (!stored) return yield* new HttpApiError.NotFound({});
        yield* (yield* Events).track({
          name: "oauth_client.project_assigned",
          category: "audit",
          target: { id: stored.id, name: stored.id, type: "oauth_client" },
          properties: {
            operationId,
            projectIds: projectId === null ? [] : [projectId],
            assigned: projectId !== null,
          },
        });
      }, sql.withTransaction);

      const clientProject = Effect.fn("OAuthClients.clientProject")(function* ({
        projectId,
      }: {
        projectId: string | null | undefined;
      }) {
        if (!projectId) return undefined;

        const [value] = yield* findProject(projectId);
        return projectSummary(value ?? null);
      });

      const publicConfigFrom = ({
        projectKey,
        summary,
        client,
      }: {
        projectKey: string;
        summary: ProjectSummary | undefined;
        client?: typeof OAuthClientRow.Type;
      }) => {
        const data = summary?.data ?? {};

        return {
          projectKey,
          name: summary?.name ?? client?.name ?? null,
          logoUrl: summary?.logo ?? client?.icon ?? null,
          authDomain: null,
          rootDomain: null,
          themeCss: sanitizeThemeCss(data.branding?.themeCss, projectKey),
          authOptions: authOptions(data),
        };
      };

      const list = Effect.fn("OAuthClients.list")(function* () {
        const betterAuth = yield* BetterAuthRequest;
        const clients = yield* Effect.promise(() =>
          betterAuth.api.getOAuthClients({ headers: betterAuth.headers }),
        );

        return yield* Effect.all(
          (clients ?? []).map((client) =>
            Effect.gen(function* () {
              const decoded = decodeRawOAuthClient(client);
              const clientId = decoded.client_id ?? decoded.clientId;
              const [stored] = clientId ? yield* findClient(clientId) : [];
              const summary = yield* clientProject({
                projectId:
                  stored?.projectId ?? decoded.project_id ?? decoded.projectId,
              });
              return adminRow(client, summary);
            }),
          ),
        );
      });

      const create = Effect.fn("OAuthClients.create")(function* ({
        payload,
      }: {
        payload: CreateOAuthClientPayload;
      }) {
        const betterAuth = yield* BetterAuthRequest;
        const events = yield* Events;
        const operationId = yield* random.uuidV7();
        yield* Effect.logDebug("OAuth client creation started").pipe(
          Effect.annotateLogs({ operationId }),
        );
        const result = yield* Effect.gen(function* () {
          const client = yield* Effect.tryPromise({
            try: () =>
              betterAuth.api.adminCreateOAuthClient({
                headers: betterAuth.headers,
                body: {
                  redirect_uris: Array.from(payload.redirectUris),
                  scope: scopesFromString(payload.scope).join(" "),
                  client_name: payload.name || undefined,
                  logo_uri: payload.icon ?? undefined,
                  token_endpoint_auth_method: "client_secret_basic",
                  grant_types: ["authorization_code", "refresh_token"],
                  response_types: ["code"],
                  application_type: "web",
                  require_pkce: true,
                  metadata: {},
                },
              }),
            catch: () => new HttpApiError.InternalServerError({}),
          });

          const decoded = decodeRawOAuthClient(client);
          const clientId = decoded.client_id ?? decoded.clientId;
          if (clientId && payload.projectId !== undefined) {
            yield* assignProject({
              clientId,
              projectId: payload.projectId,
              operationId,
            });
          }

          const summary = yield* clientProject({
            projectId: payload.projectId,
          });
          return createdRow(client, summary);
        }).pipe(Effect.result);
        if (result._tag === "Failure") {
          yield* Effect.logDebug("OAuth client creation failed").pipe(
            Effect.annotateLogs({ operationId }),
          );
          return yield* result.failure;
        }
        const [stored] = yield* findClient(result.success.clientId);
        yield* events.track({
          name: "oauth_client.created",
          category: "audit",
          target: stored
            ? {
                id: stored.id,
                name: stored.id,
                type: "oauth_client",
              }
            : {
                id: operationId,
                name: operationId,
                type: "oauth_client_operation",
              },
          properties: { operationId },
        });
        return result.success;
      });

      const getPublicConfig = Effect.fn("OAuthClients.getPublicConfig")(
        function* ({ clientId }: { clientId: string }) {
          const [client] = yield* findClient(clientId);

          if (!client || client.disabled) return null;

          const summary = yield* clientProject({
            projectId: client.projectId,
          });

          return publicConfigFrom({
            projectKey: summary?.id ?? client.clientId,
            summary,
            client,
          });
        },
      );

      const update = Effect.fn("OAuthClients.update")(function* ({
        clientId,
        payload,
      }: {
        clientId: string;
        payload: UpdateOAuthClientPayload;
      }) {
        const betterAuth = yield* BetterAuthRequest;
        const events = yield* Events;
        const operationId = yield* random.uuidV7();
        const [stored] = yield* findClient(clientId);
        // Missing identifiers may be arbitrary request input, not entity IDs.
        const targetId = stored?.id ?? operationId;
        const target = {
          id: targetId,
          name: targetId,
          type: stored ? "oauth_client" : "oauth_client_operation",
        };
        yield* Effect.logDebug("OAuth client update started").pipe(
          Effect.annotateLogs({ operationId }),
        );
        const result = yield* Effect.gen(function* () {
          const client = yield* Effect.tryPromise({
            try: () =>
              betterAuth.api.adminUpdateOAuthClient({
                headers: betterAuth.headers,
                body: {
                  client_id: clientId,
                  update: {
                    client_name: payload.name || undefined,
                    logo_uri: payload.icon ?? undefined,
                    redirect_uris: payload.redirectUris
                      ? Array.from(payload.redirectUris)
                      : undefined,
                    scope: payload.scope
                      ? scopesFromString(payload.scope).join(" ")
                      : undefined,
                    metadata: {},
                  },
                },
              }),
            catch: () => new HttpApiError.InternalServerError({}),
          });

          if (payload.projectId !== undefined) {
            yield* assignProject({
              clientId,
              projectId: payload.projectId,
              operationId,
            });
          }

          const storedProjectId =
            payload.projectId === undefined
              ? (yield* findClient(clientId))[0]?.projectId
              : payload.projectId;

          const summary = yield* clientProject({ projectId: storedProjectId });
          return adminRow(client, summary);
        }).pipe(Effect.result);
        if (result._tag === "Failure") {
          yield* Effect.logDebug("OAuth client update failed").pipe(
            Effect.annotateLogs({ operationId }),
          );
          return yield* result.failure;
        }
        yield* events.track({
          name: "oauth_client.updated",
          category: "audit",
          target,
          properties: { operationId },
        });
        return result.success;
      });

      const _delete = Effect.fn("OAuthClients.delete")(function* ({
        clientId,
      }: {
        clientId: string;
      }) {
        const betterAuth = yield* BetterAuthRequest;
        const events = yield* Events;
        const client = yield* Effect.promise(() =>
          betterAuth.api.getOAuthClient({
            headers: betterAuth.headers,
            query: { client_id: clientId },
          }),
        );

        const operationId = yield* random.uuidV7();
        const [stored] = yield* findClient(clientId);
        const targetId = stored?.id ?? operationId;
        const target = {
          id: targetId,
          name: targetId,
          type: stored ? "oauth_client" : "oauth_client_operation",
        };
        yield* Effect.logDebug("OAuth client deletion started").pipe(
          Effect.annotateLogs({ operationId }),
        );
        const result = yield* Effect.tryPromise({
          try: () =>
            betterAuth.api.deleteOAuthClient({
              headers: betterAuth.headers,
              body: { client_id: clientId },
            }),
          catch: () => new HttpApiError.InternalServerError({}),
        }).pipe(Effect.result);
        if (result._tag === "Failure") {
          yield* Effect.logDebug("OAuth client deletion failed").pipe(
            Effect.annotateLogs({ operationId }),
          );
          return yield* result.failure;
        }
        yield* events.track({
          name: "oauth_client.deleted",
          category: "audit",
          target,
          properties: { operationId },
        });

        return adminRow(client);
      });

      return {
        list,
        create,
        getPublicConfig,
        update,
        delete: _delete,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(sqlLayer),
  );
}
