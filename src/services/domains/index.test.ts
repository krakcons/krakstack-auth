import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { CredentialsFromEnv } from "@distilled.cloud/cloudflare";
import { FetchHttpClient } from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";

import { sqlTestLayer } from "@/services/database";
import { Projects } from "@/services/projects";
import { Domains } from ".";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Domains SQL persistence",
  () => {
    it.effect(
      "enriches unmanaged domains and preserves ambiguous-host authorization",
      () =>
        Effect.gen(function* () {
          const domains = yield* Domains;
          const projects = yield* Projects;
          const project = yield* projects.create({
            payload: { name: `Domain ${crypto.randomUUID()}`, data: {} },
          });
          const hostname = `${project.id}.example.com`;
          yield* Effect.gen(function* () {
            const first = yield* domains.create({
              payload: {
                hostname,
                rootHostname: "example.com",
                projectId: project.id,
                managed: false,
              },
            });
            expect(first).not.toBeNull();
            if (!first) return yield* Effect.die("Domain creation failed");
            expect(first.projectName).toBe(project.name);
            expect(first.active).toBe(true);
            expect(first.createdAt).toBeInstanceOf(Date);
            expect(yield* domains.records({ id: first.id })).toEqual([]);
            const request = new Request(`https://${hostname}/api/auth/ok`);
            expect((yield* domains.registeredForRequest({ request }))?.id).toBe(
              first.id,
            );
            const duplicate = yield* domains.create({
              payload: {
                hostname,
                rootHostname: "example.com",
                projectId: project.id,
                managed: false,
              },
            });
            expect(duplicate?.id).toBe(first.id);
            const sibling = yield* domains.create({
              payload: {
                hostname,
                rootHostname: "other.example.com",
                projectId: project.id,
                managed: false,
              },
            });
            expect(sibling?.hostnameId).toBe(first.hostnameId);
            expect(yield* domains.registeredForRequest({ request })).toBeNull();
            const updated = yield* domains.update({
              id: first.id,
              payload: {
                hostname: `updated-${hostname}`,
                rootHostname: "example.com",
                projectId: project.id,
                managed: false,
              },
            });
            expect(updated?.hostname).toBe(`updated-${hostname}`);
            expect(updated?.updatedAt).toBeInstanceOf(Date);
            expect(yield* domains.delete({ id: first.id })).toMatchObject({
              id: first.id,
            });
            expect(yield* domains.get({ id: first.id })).toBeNull();
            if (sibling) yield* domains.delete({ id: sibling.id });
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                const sql = yield* SqlClient.SqlClient;
                yield* sql`DELETE FROM domains WHERE project_id = ${project.id}`;
                yield* projects.delete({ id: project.id });
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(
          Effect.provide(Projects.baseLayer),
          Effect.provide(Domains.testLayer),
          Effect.provide(sqlTestLayer),
          Effect.provide(
            Layer.mergeAll(FetchHttpClient.layer, CredentialsFromEnv),
          ),
        ),
    );
  },
);
