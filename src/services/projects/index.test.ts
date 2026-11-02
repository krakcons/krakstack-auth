import * as Layer from "effect/Layer";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { sqlTestLayer } from "@/services/database";

import { Projects } from ".";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Projects SQL persistence",
  () => {
    it.effect(
      "scopes project stats without inferring activity from session timestamps",
      () =>
        Effect.gen(function* () {
          const projects = yield* Projects;
          const sql = yield* SqlClient.SqlClient;
          const prefix = crypto.randomUUID();
          const projectId = `${prefix}-project`;
          const otherProjectId = `${prefix}-other`;
          const organizationId = `${prefix}-org`;
          const userIds = ["active", "expired", "stale", "other"].map(
            (id) => `${prefix}-${id}`,
          );
          const now = DateTime.toDateUtc(yield* DateTime.now);
          const old = new Date(now.getTime() - 48 * 60 * 60 * 1000);
          const future = new Date(now.getTime() + 48 * 60 * 60 * 1000);
          yield* Effect.gen(function* () {
            yield* sql`INSERT INTO project ${sql.insert([
              { id: projectId, name: projectId },
              { id: otherProjectId, name: otherProjectId },
            ])}`;
            yield* Effect.forEach(
              userIds,
              (id) =>
                sql`INSERT INTO "user" (id, name, email) VALUES (${id}, ${id}, ${`${id}@example.com`})`,
            );
            yield* sql`INSERT INTO organization (id, name, slug, created_at) VALUES (${organizationId}, ${organizationId}, ${organizationId}, ${now})`;
            yield* sql`INSERT INTO project_organization (id, project_id, organization_id) VALUES (${`${prefix}-po`}, ${projectId}, ${organizationId})`;
            yield* Effect.forEach(
              userIds,
              (userId, index) =>
                sql`INSERT INTO project_user (id, project_id, user_id) VALUES (${`${prefix}-pu-${index}`}, ${index === 3 ? otherProjectId : projectId}, ${userId})`,
            );
            yield* sql`INSERT INTO session ${sql.insert([
              {
                id: `${prefix}-s1`,
                token: `${prefix}-s1`,
                userId: userIds[0],
                updatedAt: now,
                expiresAt: future,
              },
              {
                id: `${prefix}-s2`,
                token: `${prefix}-s2`,
                userId: userIds[0],
                updatedAt: now,
                expiresAt: future,
              },
              {
                id: `${prefix}-s3`,
                token: `${prefix}-s3`,
                userId: userIds[1],
                updatedAt: now,
                expiresAt: old,
              },
              {
                id: `${prefix}-s4`,
                token: `${prefix}-s4`,
                userId: userIds[2],
                updatedAt: old,
                expiresAt: future,
              },
              {
                id: `${prefix}-s5`,
                token: `${prefix}-s5`,
                userId: userIds[3],
                updatedAt: now,
                expiresAt: future,
              },
            ])}`;
            const stats = yield* projects.stats({ id: projectId, days: 7 });
            expect(stats).toMatchObject({
              users: 3,
              organizations: 1,
              dailyActiveUsers: 0,
            });
            expect(stats.dailyActiveUsersByDay).toHaveLength(7);
            expect(stats.dailyActiveUsersByDay.at(-1)).toEqual({
              date: now.toISOString().slice(0, 10),
              count: 0,
            });
            expect(stats.dailyActiveUsersByDay.at(-3)).toEqual({
              date: old.toISOString().slice(0, 10),
              count: 0,
            });
            expect(
              stats.dailyActiveUsersByDay.filter(({ count }) => count === 0),
            ).toHaveLength(7);
            expect(
              (yield* projects.stats({ id: projectId, days: 30 }))
                .dailyActiveUsersByDay,
            ).toHaveLength(30);
            const otherStats = yield* projects.stats({ id: otherProjectId });
            expect(otherStats).toMatchObject({
              users: 1,
              organizations: 0,
              dailyActiveUsers: 0,
            });
            expect(otherStats.dailyActiveUsersByDay).toHaveLength(14);
            expect(otherStats.dailyActiveUsersByDay.at(-3)?.count).toBe(0);
          }).pipe(
            Effect.ensuring(
              Effect.gen(function* () {
                yield* sql`DELETE FROM project WHERE id IN (${projectId}, ${otherProjectId})`;
                yield* sql`DELETE FROM "user" WHERE ${sql.in("id", userIds)}`;
                yield* sql`DELETE FROM organization WHERE id = ${organizationId}`;
              }).pipe(Effect.orDie),
            ),
          );
        }).pipe(
          Effect.provide(
            Projects.testLayer.pipe(Layer.provideMerge(sqlTestLayer)),
          ),
        ),
    );

    it.effect("round-trips JSON, dates, updates and missing records", () =>
      Effect.gen(function* () {
        const projects = yield* Projects;
        const data = { authOptions: { emailPassword: false, emailOtp: true } };
        const project = yield* projects.create({
          payload: {
            name: ` SQL ${crypto.randomUUID()} `,
            logo: "/logo.svg",
            data,
          },
        });
        yield* Effect.gen(function* () {
          expect(project.name).toBe(project.name.trim());
          expect(project.createdAt).toBeInstanceOf(Date);
          expect(project.data).toEqual(data);
          expect((yield* projects.get({ id: project.id }))?.data).toEqual(data);
          const updated = yield* projects.update({
            id: project.id,
            payload: { logo: null, data: { authOptions: { emailOtp: false } } },
          });
          expect(updated?.name).toBe(project.name);
          expect(updated?.logo).toBeNull();
          expect(updated?.data).toEqual({ authOptions: { emailOtp: false } });
          expect(updated?.updatedAt).toBeInstanceOf(Date);
          const config = yield* projects.getPublicConfig({
            projectId: project.id,
          });
          expect(config.authOptions.emailOtp).toBe(false);
          expect(yield* projects.delete({ id: project.id })).toMatchObject({
            id: project.id,
          });
          expect(yield* projects.get({ id: project.id })).toBeNull();
          expect(
            yield* projects.update({ id: project.id, payload: { data: {} } }),
          ).toBeNull();
          expect(yield* projects.delete({ id: project.id })).toBeNull();
        }).pipe(
          Effect.ensuring(
            projects.delete({ id: project.id }).pipe(Effect.orDie),
          ),
        );
      }).pipe(Effect.provide(Projects.testLayer)),
    );
  },
);
