import { Context, Effect, Layer, Schema } from "effect";
import { eq } from "drizzle-orm";

import { project } from "@/db/auth-schema";
import { normalizeOAuthClientDomains } from "@/lib/domain-utils";
import { DB } from "@/services/database";

import {
  ProjectData,
  type CreateProjectPayload,
  type UpdateProjectPayload,
} from "./schema";

const emptyData: ProjectData = {};

export const decodeProjectData = (value: unknown) => {
  const data = Schema.decodeUnknownSync(ProjectData)(value ?? emptyData);
  const domains = normalizeOAuthClientDomains(data.domains ?? []);
  return { ...data, ...(domains.length ? { domains } : {}) };
};

export const decodeProjectDataOrEmpty = (value: unknown) => {
  try {
    return decodeProjectData(value);
  } catch {
    return emptyData;
  }
};

const row = (value: typeof project.$inferSelect) => ({
  ...value,
  logo: value.logo ?? null,
  data: decodeProjectDataOrEmpty(value.data),
});

export class Projects extends Context.Service<Projects>()("Projects", {
  make: Effect.gen(function* () {
    const db = yield* DB;

    const list = Effect.fn("Projects.list")(function* () {
      const rows = yield* db.query.project.findMany({
        orderBy: { name: "asc" },
      });
      return rows.map(row);
    });

    const get = Effect.fn("Projects.get")(function* ({ id }: { id: string }) {
      const value = yield* db.query.project.findFirst({ where: { id } });
      return value ? row(value) : null;
    });

    const create = Effect.fn("Projects.create")(function* ({
      payload,
    }: {
      payload: CreateProjectPayload;
    }) {
      const [value] = yield* db
        .insert(project)
        .values({
          id: crypto.randomUUID(),
          name: payload.name.trim(),
          slug: payload.slug.trim(),
          logo: payload.logo ?? null,
          data: decodeProjectData(payload.data),
        })
        .returning();

      return value ? row(value) : null;
    });

    const update = Effect.fn("Projects.update")(function* ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateProjectPayload;
    }) {
      const [value] = yield* db
        .update(project)
        .set({
          ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
          ...(payload.slug !== undefined ? { slug: payload.slug.trim() } : {}),
          ...(payload.logo !== undefined ? { logo: payload.logo } : {}),
          data: decodeProjectData(payload.data),
          updatedAt: new Date(),
        })
        .where(eq(project.id, id))
        .returning();

      return value ? row(value) : null;
    });

    const _delete = Effect.fn("Projects.delete")(function* ({
      id,
    }: {
      id: string;
    }) {
      const [value] = yield* db
        .delete(project)
        .where(eq(project.id, id))
        .returning();

      return value ? row(value) : null;
    });

    return { list, get, create, update, delete: _delete };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DB.layer),
  );
}
