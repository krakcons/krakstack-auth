import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { Events } from "@krak-stack/registry/events";

import { sqlTestLayer } from "@/services/database";
import { testEventsLayer } from "@/services/audit/test-layer";
import { authForRequest } from "@/services/auth/config";
import { Projects } from "@/services/projects";
import { ProjectMcpService } from "./index";
import { resolveProjectMcp } from "./runtime";
import { ProjectMcpSettings } from "./schema";

const services = Layer.mergeAll(
  ProjectMcpService.layer,
  Projects.baseLayer,
).pipe(Layer.provideMerge(testEventsLayer), Layer.provideMerge(sqlTestLayer));

const fixture = Effect.acquireRelease(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const id = crypto.randomUUID();
    const host = `mcp-${id}.example.test`;
    yield* sql`INSERT INTO project (id, name) VALUES (${id}, 'MCP test'), (${`${id}-other`}, 'Other project')`;
    yield* sql`INSERT INTO domains (id, hostname, root_hostname, project_id, hostname_id, managed, active)
      VALUES (${id}, ${host}, 'example.test', ${id}, ${id}, false, true)`;
    return { id, host, url: `https://${host}/api/mcp` };
  }),
  ({ id, host }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`DELETE FROM project WHERE id IN (${id}, ${`${id}-other`})`;
      yield* sql`DELETE FROM oauth_client_resource WHERE resource_id LIKE ${`https://${host}/%`}`;
      yield* sql`DELETE FROM oauth_client WHERE name = ${`mcp-test-${id}`}`;
      yield* sql`DELETE FROM oauth_resource WHERE identifier LIKE ${`https://${host}/%`}`;
      yield* sql`DELETE FROM events WHERE payload_json::text LIKE ${`%${id}%`}`;
    }).pipe(Effect.orDie),
);

const metadata = Effect.fnUntraced(function* (host: string) {
  const request = new Request(
    `https://${host}/api/auth/.well-known/oauth-authorization-server`,
  );
  const auth = yield* Effect.promise(() => authForRequest(request));
  const response = yield* Effect.promise(() => auth.handler(request));
  expect(response.status).toBe(200);
  return yield* Schema.decodeUnknownEffect(
    Schema.Struct({ registration_endpoint: Schema.optional(Schema.String) }),
  )(yield* Effect.promise(() => response.json()));
});

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "project MCP configuration",
  () => {
    it.effect(
      "persists project policy and changes discovery across cached auth instances without env configuration",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const service = yield* ProjectMcpService;
          const { id, host, url } = yield* fixture;
          const payload = {
            url,
            enabled: true,
            dynamicClientRegistration: true,
            scopes: ["mcp:read", "mcp:write"],
          } satisfies ProjectMcpSettings;
          expect(yield* service.get({ projectId: id })).toBeNull();
          expect((yield* metadata(host)).registration_endpoint).toBeUndefined();
          yield* service.configure({
            projectId: id,
            settings: { ...payload, scopes: ["mcp:read"] },
          });
          const deniedWrite = yield* Effect.promise(async () => {
            const request = new Request(
              `https://${host}/api/auth/oauth2/register`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  client_name: `mcp-test-${id}`,
                  redirect_uris: ["https://agent.example.com/callback"],
                  token_endpoint_auth_method: "none",
                  scope: "mcp:read mcp:write offline_access",
                }),
              },
            );
            return (await authForRequest(request)).handler(request);
          });
          expect(deniedWrite.status).toBe(400);
          expect(
            yield* Schema.decodeUnknownEffect(
              Schema.Struct({ error: Schema.String }),
            )(yield* Effect.promise(() => deniedWrite.json())),
          ).toEqual({ error: "invalid_scope" });
          const saved = yield* service.configure({
            projectId: id,
            settings: payload,
          });
          expect(saved).toEqual({ projectId: id, ...payload });
          expect((yield* metadata(host)).registration_endpoint).toBe(
            `https://${host}/api/auth/oauth2/register`,
          );
          expect(
            yield* resolveProjectMcp({
              projectId: id,
              host,
              protocol: "https",
            }),
          ).toEqual(saved);
          expect(
            yield* resolveProjectMcp({
              projectId: `${id}-other`,
              host,
              protocol: "https",
            }),
          ).toBeNull();
          expect(
            yield* resolveProjectMcp({
              projectId: id,
              host: "other.example.test",
              protocol: "https",
            }),
          ).toBeNull();
          yield* service.configure({
            projectId: id,
            settings: { ...payload, dynamicClientRegistration: false },
          });
          expect((yield* metadata(host)).registration_endpoint).toBeUndefined();
          expect((yield* service.get({ projectId: id }))?.enabled).toBe(true);
          yield* service.configure({ projectId: id, settings: payload });
          expect((yield* metadata(host)).registration_endpoint).toBeDefined();
          const registration = yield* Effect.promise(async () => {
            const request = new Request(
              `https://${host}/api/auth/oauth2/register`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  client_name: `mcp-test-${id}`,
                  redirect_uris: ["https://agent.example.com/callback"],
                  token_endpoint_auth_method: "none",
                  scope: "mcp:read mcp:write offline_access",
                }),
              },
            );
            return (await authForRequest(request)).handler(request);
          });
          expect(registration.status).toBe(201);
          const client = yield* Schema.decodeUnknownEffect(
            Schema.Struct({ client_id: Schema.String, scope: Schema.String }),
          )(yield* Effect.promise(() => registration.json()));
          expect(client.scope.split(" ")).toContain("mcp:write");
          expect(
            yield* sql`SELECT resource_id FROM oauth_client_resource WHERE client_id = ${client.client_id}`,
          ).toEqual([{ resourceId: url }]);
          const nextUrl = `https://${host}/tools/mcp`;
          yield* service.configure({
            projectId: id,
            settings: { ...payload, url: nextUrl },
          });
          expect(
            yield* sql`SELECT disabled FROM oauth_resource WHERE identifier = ${url}`,
          ).toEqual([{ disabled: true }]);
          expect(
            yield* sql`SELECT resource_id FROM oauth_client_resource WHERE client_id = ${client.client_id}`,
          ).toEqual([]);
          expect(
            (yield* resolveProjectMcp({
              projectId: id,
              host,
              protocol: "https",
            }))?.url,
          ).toBe(nextUrl);
          yield* service.configure({
            projectId: id,
            settings: { ...payload, url: nextUrl, enabled: false },
          });
          expect((yield* metadata(host)).registration_endpoint).toBeUndefined();
          expect(
            yield* resolveProjectMcp({
              projectId: id,
              host,
              protocol: "https",
            }),
          ).toBeNull();
          expect(
            yield* sql`SELECT disabled FROM oauth_resource WHERE identifier = ${nextUrl}`,
          ).toEqual([{ disabled: true }]);
        }).pipe(Effect.scoped, Effect.provide(services)),
      { timeout: 30_000 },
    );

    it.effect(
      "rejects cross-project and inactive domains, fails closed on reassignment, and can disable an orphaned endpoint",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const service = yield* ProjectMcpService;
          const { id, host, url } = yield* fixture;
          const settings = {
            url,
            enabled: true,
            dynamicClientRegistration: true,
            scopes: ["mcp:read"],
          } satisfies ProjectMcpSettings;
          const forbidden = yield* service
            .configure({ projectId: `${id}-other`, settings })
            .pipe(Effect.flip);
          expect(forbidden._tag).toBe("InvalidMcpEndpoint");
          yield* sql`UPDATE domains SET active = false WHERE id = ${id}`;
          expect(
            (yield* service
              .configure({ projectId: id, settings })
              .pipe(Effect.flip))._tag,
          ).toBe("InvalidMcpEndpoint");
          yield* sql`UPDATE domains SET active = true WHERE id = ${id}`;
          yield* service.configure({ projectId: id, settings });
          yield* sql`UPDATE domains SET project_id = ${`${id}-other`} WHERE id = ${id}`;
          expect(
            yield* resolveProjectMcp({
              projectId: id,
              host,
              protocol: "https",
            }),
          ).toBeNull();
          expect((yield* metadata(host)).registration_endpoint).toBeUndefined();
          expect(
            (yield* service.configure({
              projectId: id,
              settings: { ...settings, enabled: false },
            }))?.enabled,
          ).toBe(false);
          expect(
            yield* service.configure({ projectId: "missing", settings }),
          ).toBeNull();
        }).pipe(Effect.scoped, Effect.provide(services)),
    );

    it.effect(
      "rolls back resource and settings changes if audit persistence fails, and disables resources when a project is deleted",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const service = yield* ProjectMcpService;
          const events = yield* Events;
          const { id, url } = yield* fixture;
          const settings = {
            url,
            enabled: true,
            dynamicClientRegistration: true,
            scopes: ["mcp:read"],
          } satisfies ProjectMcpSettings;
          const failed = yield* ProjectMcpService.make.pipe(
            Effect.provideService(Events, {
              ...events,
              track: () => Effect.die("test audit unavailable"),
            }),
          );
          const result = yield* failed
            .configure({ projectId: id, settings })
            .pipe(Effect.exit);
          expect(Exit.isFailure(result)).toBe(true);
          expect(yield* service.get({ projectId: id })).toBeNull();
          expect(
            yield* sql`SELECT identifier FROM oauth_resource WHERE identifier = ${url}`,
          ).toEqual([]);
          yield* service.configure({ projectId: id, settings });
          yield* (yield* Projects).delete({ id });
          expect(yield* service.get({ projectId: id })).toBeNull();
          expect(
            yield* sql`SELECT disabled FROM oauth_resource WHERE identifier = ${url}`,
          ).toEqual([{ disabled: true }]);
        }).pipe(Effect.scoped, Effect.provide(services)),
    );
  },
);
