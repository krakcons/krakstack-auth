import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { sqlTestLayer } from "@/services/database";
import { createAuth } from "../config";
import { handleProjectOAuth } from "./index";

afterEach(() => vi.unstubAllEnvs());

describe.skipIf(!process.env.TEST_DATABASE_URL)("Central Google sign-in", () => {
  it.effect(
    "keeps provider state on the central host and issues a session only on project redemption",
    () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const id = crypto.randomUUID();
        const hostname = `${id}.example.test`;
        const project = `https://${hostname}`;
        const central = "https://auth.example.test";
        const email = `${id}@example.test`;
        vi.stubEnv("BETTER_AUTH_URL", central);
        vi.stubEnv("PROJECT_GOOGLE_OAUTH_ORIGINS", project);
        yield* sql`INSERT INTO project (id, name) VALUES (${id}, 'Central OAuth test')`;
        yield* sql`INSERT INTO domains (id, hostname, root_hostname, project_id, hostname_id, managed, active)
        VALUES (${id}, ${hostname}, ${hostname}, ${id}, ${id}, false, true)`;
        yield* Effect.promise(async () => {
          const projectAuth = createAuth({ allowedHosts: [hostname], fixedBaseURL: project });
          const auth = createAuth({
            allowedHosts: [new URL(central).host],
            fixedBaseURL: central,
            projectId: id,
            auditRun: () => Promise.resolve(),
          });
          const context = await auth.$context;
          context.socialProviders.splice(0, context.socialProviders.length, {
            id: "google",
            name: "Test Google",
            accountSubject: () => id,
            createAuthorizationURL: async ({ state, redirectURI, codeVerifier }) => {
              expect(codeVerifier).toBeTruthy();
              const provider = new URL("https://accounts.google.com/o/oauth2/v2/auth");
              provider.searchParams.set("state", state);
              provider.searchParams.set("redirect_uri", redirectURI);
              return provider;
            },
            validateAuthorizationCode: async ({ code, redirectURI, codeVerifier }) => {
              expect(code).toBe("test-provider-code");
              expect(redirectURI).toBe(`${central}/api/auth/callback/google`);
              expect(codeVerifier).toBeTruthy();
              return { accessToken: "test-provider-access-token" };
            },
            getUserInfo: async () => ({
              user: { email, name: "OAuth Test", emailVerified: true },
              data: {},
            }),
          });
          const handle = (request: Request) => handleProjectOAuth(request, projectAuth, () => auth);
          const proxyHeaders = {
            "x-forwarded-host": hostname,
            "x-forwarded-proto": "https",
          };
          const start = await handle(
            new Request(`${central}/api/auth/sign-in/social`, {
              method: "POST",
              headers: { ...proxyHeaders, Origin: project, "Content-Type": "application/json" },
              body: JSON.stringify({ provider: "google", callbackURL: "/dashboard" }),
            }),
          );
          expect(start?.status).toBe(200);
          const projectCookie = start?.headers.getSetCookie()[0]?.split(";")[0] ?? "";
          expect(projectCookie).toMatch(/^__Host-krakstack-project-oauth=/);
          const { url } = await start?.json();
          const redirect = await handle(new Request(url));
          expect(redirect?.status).toBe(303);
          const location = new URL(redirect?.headers.get("location") ?? "");
          expect(location.searchParams.get("redirect_uri")).toBe(
            `${central}/api/auth/callback/google`,
          );
          const stateCookie = redirect?.headers.getSetCookie()[0]?.split(";")[0] ?? "";
          const callback = new URL(`${central}/api/auth/callback/google`);
          callback.searchParams.set("state", location.searchParams.get("state") ?? "");
          callback.searchParams.set("code", "test-provider-code");
          expect((await handle(new Request(callback)))?.status).toBe(403);
          const completed = await handle(
            new Request(callback, { headers: { Cookie: stateCookie } }),
          );
          expect(completed?.status).toBe(303);
          expect(completed?.headers.getSetCookie()).toEqual([expect.stringContaining("Max-Age=0")]);
          const redeem = new URL(completed?.headers.get("location") ?? "");
          expect(redeem.origin).toBe(project);
          const upstream = new URL(redeem.pathname + redeem.search, central);
          expect((await handle(new Request(upstream, { headers: proxyHeaders })))?.status).toBe(
            403,
          );
          const browser = () =>
            new Request(upstream, { headers: { ...proxyHeaders, Cookie: projectCookie } });
          const session = await handle(browser());
          expect(session?.status).toBe(303);
          expect(session?.headers.get("location")).toBe(`${project}/dashboard`);
          const sessionCookie = session?.headers.getSetCookie()[0]?.split(";")[0] ?? "";
          expect(sessionCookie).toMatch(/krakstack-auth\.session_token=/);
          const local = await projectAuth.api.getSession({
            headers: new Headers({ Cookie: sessionCookie }),
          });
          expect(local?.user.email).toBe(email);
          expect((await handle(browser()))?.status).toBe(403);
        }).pipe(
          Effect.ensuring(
            Effect.gen(function* () {
              yield* sql`DELETE FROM project_oauth_flow WHERE project_id = ${id}`;
              yield* sql`DELETE FROM domains WHERE id = ${id}`;
              yield* sql`DELETE FROM project WHERE id = ${id}`;
              const users = yield* sql<{
                id: string;
              }>`SELECT id FROM "user" WHERE email = ${email}`;
              for (const user of users) {
                yield* sql`DELETE FROM organization WHERE user_id = ${user.id}`;
                yield* sql`DELETE FROM "user" WHERE id = ${user.id}`;
              }
            }).pipe(Effect.orDie),
          ),
        );
      }).pipe(Effect.provide(sqlTestLayer)),
  );
});
