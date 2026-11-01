import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, ManagedRuntime, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { WorkflowEngine } from "effect/workflow";
import { HttpClient, HttpClientResponse } from "effect/http";
import { Webhooks } from "@krak-stack/registry/webhooks";
import { webhookMigrationsLayer } from "@krak-stack/registry/webhooks/migrations";
import { sqlTestLayer } from "@/services/database";
import { testEventsLayer } from "@/services/audit/test-layer";
import { createAuth } from "@/services/auth/config";
import { ProjectWebhooks } from "@/services/webhooks";
import { AccountDeletions } from "./index";
import { deletionSubscriberLayer } from "./subscriber";
import { deletionEvent } from "./schema";

const http = HttpClient.make((request) => Effect.succeed(HttpClientResponse.fromWeb(request, new Response(null, { status: 204 }))));
const services = AccountDeletions.layer.pipe(
  Layer.provideMerge(ProjectWebhooks.layer.pipe(
    Layer.provideMerge(Webhooks.layerWithoutMigrations.pipe(
      Layer.provide(webhookMigrationsLayer),
      Layer.provide(Layer.succeed(HttpClient.HttpClient, http)),
      Layer.provideMerge(WorkflowEngine.layerMemory),
      Layer.provideMerge(sqlTestLayer),
    )),
  )),
  Layer.provideMerge(testEventsLayer),
);
const subscribed = deletionSubscriberLayer.pipe(Layer.provideMerge(services));

describe.skipIf(!process.env.TEST_DATABASE_URL)("Native account deletion", () => {
  it.effect("uses Better Auth security, captures routing before cascades, and publishes only after deletion", () => TestClock.withLive(Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const runtime = ManagedRuntime.make(subscribed);
    const id = crypto.randomUUID();
    const otherId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const directProject = crypto.randomUUID();
    const organizationProject = crypto.randomUUID();
    const clientId = crypto.randomUUID();
    const password = "native-deletion-test-password-123";
    const email = `${id}@example.test`;
    yield* Effect.addFinalizer(() => Effect.gen(function* () {
      yield* sql`DELETE FROM oauth_client WHERE client_id = ${clientId}`;
      yield* sql`DELETE FROM organization WHERE id = ${orgId}`;
      yield* sql`DELETE FROM webhooks WHERE organization_id IN (${directProject}, ${organizationProject})`;
      yield* sql`DELETE FROM webhook_publications WHERE organization_id IN (${directProject}, ${organizationProject})`;
      yield* sql`DELETE FROM events WHERE organization_id IN (${directProject}, ${organizationProject})`;
      yield* sql`DELETE FROM project WHERE id IN (${directProject}, ${organizationProject})`;
      yield* sql`DELETE FROM "user" WHERE id IN (${id}, ${otherId})`;
      yield* sql`DELETE FROM apikey WHERE reference_id = ${id}`;
    }).pipe(Effect.orDie));
    yield* Effect.addFinalizer(() => Effect.promise(() => runtime.dispose()));
    const auth = createAuth({ allowedHosts: ["localhost:3001"], auditRun: async () => {}, deletionRun: (effect) => runtime.runPromise(effect) });
    const context = yield* Effect.promise(() => auth.$context);
    const now = new Date();
    for (const userId of [id, otherId]) yield* Effect.promise(() => context.adapter.create({ model: "user", data: { id: userId, name: "Deletion test", email: `${userId}@example.test`, emailVerified: true, role: "user", createdAt: now, updatedAt: now }, forceAllowId: true }));
    const hash = yield* Effect.promise(() => context.password.hash(password));
    yield* Effect.promise(() => context.internalAdapter.createAccount({ userId: id, accountId: id, providerId: "credential", password: hash, createdAt: now, updatedAt: now }));
    yield* sql`INSERT INTO project (id, name) VALUES (${directProject}, 'Direct project'), (${organizationProject}, 'Organization project')`;
    yield* sql`INSERT INTO project_user (id, project_id, user_id) VALUES (${crypto.randomUUID()}, ${directProject}, ${id})`;
    yield* sql`INSERT INTO organization (id, name, slug, created_at, user_id) VALUES (${orgId}, 'Shared organization', ${orgId}, now(), ${id})`;
    yield* sql`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES
      (${crypto.randomUUID()}, ${orgId}, ${id}, 'owner', now()), (${crypto.randomUUID()}, ${orgId}, ${otherId}, 'owner', now())`;
    yield* sql`INSERT INTO project_organization (id, project_id, organization_id) VALUES (${crypto.randomUUID()}, ${organizationProject}, ${orgId})`;
    yield* sql`INSERT INTO oauth_client (id, client_id, redirect_uris, user_id) VALUES (${clientId}, ${clientId}, '{}', ${id})`;
    yield* sql`INSERT INTO apikey (id, config_id, reference_id, key, created_at, updated_at) VALUES (${crypto.randomUUID()}, 'user', ${id}, ${crypto.randomUUID()}, now(), now())`;
    const signIn = yield* Effect.tryPromise({ try: () => auth.api.signInEmail({ request: new Request("https://localhost:3001/api/auth/sign-in/email"), body: { email, password }, returnHeaders: true }), catch: (error) => error }).pipe(
      Effect.catch((error) => error instanceof Response
        ? Effect.promise(() => error.text()).pipe(Effect.flatMap((body) => Effect.fail(new Error(`Native sign in ${error.status}: ${body}`))))
        : Effect.fail(error)),
    );
    const cookie = signIn.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    const remove = (body: { password?: string }) => auth.handler(new Request("https://localhost:3001/api/auth/delete-user", {
      method: "POST",
      headers: { cookie, origin: "https://localhost:3001", "content-type": "application/json" },
      body: JSON.stringify(body),
    }));
    const denied = yield* Effect.promise(() => remove({ password }));
    expect(denied.status).toBe(403);
    expect(yield* Effect.promise(() => denied.json())).toMatchObject({ code: "ACCOUNT_DELETION_BLOCKED", message: "organization_owner" });
    expect(yield* sql`SELECT id FROM account WHERE user_id = ${id}`).toHaveLength(1);
    expect(yield* sql`SELECT event_id FROM events WHERE event_name = ${deletionEvent} AND organization_id IN (${directProject}, ${organizationProject})`).toHaveLength(0);
    yield* sql`UPDATE member SET role = 'member' WHERE user_id = ${id}`;
    yield* sql`UPDATE "user" SET role = 'admin' WHERE id = ${id}`;
    const adminDenied = yield* Effect.promise(() => remove({ password }));
    expect(adminDenied.status).toBe(403);
    expect(yield* Effect.promise(() => adminDenied.json())).toMatchObject({ code: "ACCOUNT_DELETION_BLOCKED", message: "admin_account" });
    yield* sql`UPDATE "user" SET role = 'user' WHERE id = ${id}`;
    const config = yield* Effect.promise(() => runtime.runPromise(Effect.gen(function* () {
      const webhooks = yield* ProjectWebhooks;
      const first = yield* webhooks.configure({ projectId: directProject, url: "https://example.com/api/webhooks/auth" });
      const updated = yield* webhooks.configure({ projectId: directProject, url: "https://example.org/api/webhooks/auth" });
      expect(updated?.secret).toBe(first?.secret);
      expect(updated?.events).toBeNull();
      yield* webhooks.configure({ projectId: organizationProject, url: "https://example.com/api/webhooks/auth" });
      return yield* (yield* AccountDeletions).plan({ userId: id });
    })));
    expect(config.projects.map((project) => project.id).sort()).toEqual([directProject, organizationProject].sort());
    expect(config.projects.every((project) => project.ready)).toBe(true);
    yield* sql`UPDATE session SET created_at = now() - interval '1 day' WHERE user_id = ${id}`;
    const stale = yield* Effect.promise(() => remove({}));
    expect(stale.status).toBe(400);
    const deleted = yield* Effect.promise(() => remove({ password }));
    expect({ status: deleted.status, body: yield* Effect.promise(() => deleted.text()) }).toMatchObject({ status: 200 });
    expect(yield* sql`SELECT id FROM "user" WHERE id = ${id}`).toHaveLength(0);
    expect(yield* sql`SELECT id FROM session WHERE user_id = ${id}`).toHaveLength(0);
    expect(yield* sql`SELECT id FROM account WHERE user_id = ${id}`).toHaveLength(0);
    expect(yield* sql`SELECT id FROM apikey WHERE config_id = 'user' AND reference_id = ${id}`).toHaveLength(0);
    expect(yield* sql`SELECT id FROM organization WHERE id = ${orgId} AND user_id IS NULL`).toHaveLength(1);
    expect(yield* sql`SELECT id FROM oauth_client WHERE client_id = ${clientId} AND user_id IS NULL`).toHaveLength(1);
    const publications = yield* sql`SELECT data FROM webhook_publications WHERE organization_id IN (${directProject}, ${organizationProject})`.pipe(
      Effect.repeat({ until: (rows) => rows.length === 2, schedule: Schedule.spaced("20 millis") }), Effect.timeout("10 seconds"),
    );
    expect(publications).toHaveLength(2);
    expect(JSON.stringify(publications)).not.toContain(email);
    expect(JSON.stringify(publications)).not.toContain(password);
    expect(JSON.stringify(publications)).toContain(id);
  })).pipe(Effect.scoped, Effect.provide(sqlTestLayer)), { timeout: 30_000 });
});
