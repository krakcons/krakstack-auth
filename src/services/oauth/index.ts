import { Context, Effect, Layer, Schema } from "effect";
import { eq } from "drizzle-orm";

import { oauthClient, project } from "@/db/auth-schema";
import { DB } from "@/services/database";
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
  signUp: data.authOptions?.signUp ?? true,
  signUpName: data.authOptions?.signUpName ?? true,
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

const adminRow = (client: object, projectSummary?: ProjectSummary) => {
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

const createdRow = (client: object, projectSummary?: ProjectSummary) => {
  const decoded = decodeRawOAuthClient(client);

  return {
    ...adminRow(client, projectSummary),
    clientSecret: decoded.client_secret ?? decoded.clientSecret ?? "",
  };
};

const projectSummary = (value: typeof project.$inferSelect | null) =>
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
      const db = yield* DB;

      const clientProject = Effect.fn("OAuthClients.clientProject")(function* ({
        projectId,
      }: {
        projectId: string | null | undefined;
      }) {
        if (!projectId) return undefined;

        const value = yield* db.query.project.findFirst({
          where: { id: projectId },
        });
        return projectSummary(value ?? null);
      });

      const publicConfigFrom = ({
        projectKey,
        summary,
        client,
      }: {
        projectKey: string;
        summary: ProjectSummary | undefined;
        client?: typeof oauthClient.$inferSelect;
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
              const stored = clientId
                ? yield* db.query.oauthClient.findFirst({ where: { clientId } })
                : null;
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
        const client = yield* Effect.promise(() =>
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
              type: "web",
              require_pkce: true,
              metadata: {},
            },
          }),
        );

        const decoded = decodeRawOAuthClient(client);
        const clientId = decoded.client_id ?? decoded.clientId;
        if (clientId && payload.projectId !== undefined) {
          yield* db
            .update(oauthClient)
            .set({ projectId: payload.projectId, metadata: {} })
            .where(eq(oauthClient.clientId, clientId));
        }

        const summary = yield* clientProject({ projectId: payload.projectId });
        return createdRow(client, summary);
      });

      const getPublicConfig = Effect.fn("OAuthClients.getPublicConfig")(
        function* ({ clientId }: { clientId: string }) {
          const [client] = yield* db
            .select()
            .from(oauthClient)
            .where(eq(oauthClient.clientId, clientId))
            .limit(1);

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
        const client = yield* Effect.promise(() =>
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
        );

        if (payload.projectId !== undefined) {
          yield* db
            .update(oauthClient)
            .set({ projectId: payload.projectId, metadata: {} })
            .where(eq(oauthClient.clientId, clientId));
        }

        const storedProjectId =
          payload.projectId === undefined
            ? (yield* db.query.oauthClient.findFirst({
                where: { clientId },
                columns: { projectId: true },
              }))?.projectId
            : payload.projectId;

        const summary = yield* clientProject({ projectId: storedProjectId });
        return adminRow(client, summary);
      });

      const _delete = Effect.fn("OAuthClients.delete")(function* ({
        clientId,
      }: {
        clientId: string;
      }) {
        const betterAuth = yield* BetterAuthRequest;
        const client = yield* Effect.promise(() =>
          betterAuth.api.getOAuthClient({
            headers: betterAuth.headers,
            query: { client_id: clientId },
          }),
        );

        yield* Effect.promise(() =>
          betterAuth.api.deleteOAuthClient({
            headers: betterAuth.headers,
            body: { client_id: clientId },
          }),
        );

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
    Layer.provide(DB.layer),
  );
}
