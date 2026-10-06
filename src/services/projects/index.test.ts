import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { Projects } from ".";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Projects SQL persistence",
  () => {
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
