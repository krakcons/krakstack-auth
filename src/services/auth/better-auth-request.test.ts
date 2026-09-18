import { describe, expect, it } from "@effect/vitest";
import { eq } from "drizzle-orm";
import { Effect, Redacted } from "effect";
import { proxyOriginHeaders } from "@krak-stack/auth/server";

import { domains, project } from "@/db/schema";
import { DB } from "@/services/database";
import { restoreProxyAuthOrigin } from "./better-auth-request";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "restoreProxyAuthOrigin domain authorization",
  () => {
    for (const scenario of [
      "valid",
      "wrong-project",
      "invalid-key",
      "referrer-denied",
      "inactive",
      "unregistered",
      "ambiguous",
    ]) {
      it.effect(
        `checks proxy credentials against ${scenario} domain registration`,
        () => {
          const projectId = `proxy-test-${crypto.randomUUID()}`;
          const hostname = `${projectId}.example.com`;
          const apiKey = Redacted.make("svc_test-only-service-key");
          return Effect.gen(function* () {
            const db = yield* DB;
            yield* db
              .insert(project)
              .values({ id: projectId, name: "Proxy test" });
            yield* db.insert(domains).values({
              id: projectId,
              hostname,
              rootHostname: hostname,
              hostnameId: projectId,
              projectId,
              active: scenario !== "inactive",
              managed: false,
            });
            if (scenario === "ambiguous") {
              yield* db.insert(domains).values({
                id: `${projectId}-duplicate`,
                hostname,
                rootHostname: "example.com",
                hostnameId: projectId,
                projectId,
                active: true,
                managed: false,
              });
            }
            const request = new Request(
              `https://${scenario === "unregistered" ? "unregistered.example.com" : hostname}/api/auth/email-otp/send-verification-otp`,
              {
                method: "POST",
                body: JSON.stringify({
                  email: "learner@example.com",
                  type: "sign-in",
                }),
              },
            );
            const headers = yield* proxyOriginHeaders(request, apiKey);
            headers.set("x-forwarded-host", "auth.krakstack.net");
            headers.set("x-forwarded-proto", "http");
            const upstream = new Request(
              `https://auth.krakstack.net${new URL(request.url).pathname}`,
              {
                method: "POST",
                headers,
                body: request.body,
              },
            );
            let verificationCalls = 0;
            const permittedProject =
              scenario === "wrong-project" ? `other-${projectId}` : projectId;
            const restore = restoreProxyAuthOrigin(
              upstream,
              async ({ body }) => {
                verificationCalls++;
                expect(body.configId).toBe("service");
                expect(body.key).toBe(Redacted.value(apiKey));
                expect(body.permissions).toEqual({
                  [projectId]: ["auth:proxy"],
                });
                return {
                  valid:
                    scenario !== "invalid-key" &&
                    Boolean(
                      body.permissions[permittedProject]?.includes(
                        "auth:proxy",
                      ),
                    ),
                  key: {
                    metadata: {
                      allowedOrigins:
                        scenario === "referrer-denied"
                          ? ["https://other.example.com"]
                          : [],
                    },
                  },
                };
              },
            );
            if (scenario !== "valid") {
              expect(yield* Effect.flip(restore)).toMatchObject({
                _tag: "AuthProxyError",
                reason: "invalid",
              });
              return;
            }
            const restored = yield* restore;
            expect(verificationCalls).toBe(1);
            expect(restored.headers.get("x-forwarded-host")).toBe(hostname);
            expect(restored.headers.get("x-forwarded-proto")).toBe("https");
            expect(
              Array.from(restored.headers.keys()).some((name) =>
                name.startsWith("x-krakstack-"),
              ),
            ).toBe(false);
            expect(restored.method).toBe("POST");
            expect(yield* Effect.promise(() => restored.json())).toEqual({
              email: "learner@example.com",
              type: "sign-in",
            });
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                const db = yield* DB;
                yield* db
                  .delete(domains)
                  .where(eq(domains.projectId, projectId));
                yield* db.delete(project).where(eq(project.id, projectId));
              }).pipe(Effect.orDie),
            ),
            Effect.provide(DB.testLayer),
          );
        },
      );
    }
  },
);
