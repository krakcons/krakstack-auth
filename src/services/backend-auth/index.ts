import { Context, Effect, Layer } from "effect";
import { eq, inArray } from "drizzle-orm";

import { organization, user } from "@/db/auth-schema";
import type { AuthOrganization } from "@/lib/auth-schema";
import { db } from "@/services/database";
import type {
  BackendAuthOrganizationsResponse,
  BackendAuthUsersResponse,
} from "./schema";

const parseMetadata = (value: string | null): unknown | null => {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const uniqueIds = (ids: ReadonlyArray<string>) =>
  Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

const orderedBatch = <A extends { id: string }>(
  ids: ReadonlyArray<string>,
  records: ReadonlyArray<A>,
) => {
  const byId = new Map(records.map((record) => [record.id, record]));
  const data = ids.flatMap((id) => {
    const record = byId.get(id);
    return record ? [record] : [];
  });

  return {
    data,
    missingIds: ids.filter((id) => !byId.has(id)),
  };
};

export class BackendAuth extends Context.Service<BackendAuth>()("BackendAuth", {
  make: Effect.sync(() => {
    const listUsersByIds = Effect.fn("BackendAuth.listUsersByIds")(function* ({
      ids,
    }: {
      ids: ReadonlyArray<string>;
    }) {
      const normalizedIds = uniqueIds(ids);
      if (normalizedIds.length === 0) {
        return { data: [], missingIds: [] } satisfies BackendAuthUsersResponse;
      }

      const records = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              id: user.id,
              name: user.name,
              email: user.email,
              emailVerified: user.emailVerified,
              image: user.image,
              role: user.role,
              banned: user.banned,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            })
            .from(user)
            .where(inArray(user.id, normalizedIds)),
        catch: (error) => error,
      });

      return orderedBatch(
        normalizedIds,
        records,
      ) satisfies BackendAuthUsersResponse;
    });

    const getUser = Effect.fn("BackendAuth.getUser")(function* ({
      id,
    }: {
      id: string;
    }) {
      const [record] = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              id: user.id,
              name: user.name,
              email: user.email,
              emailVerified: user.emailVerified,
              image: user.image,
              role: user.role,
              banned: user.banned,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            })
            .from(user)
            .where(eq(user.id, id))
            .limit(1),
        catch: (error) => error,
      });

      return record;
    });

    const listOrganizationsByIds = Effect.fn(
      "BackendAuth.listOrganizationsByIds",
    )(function* ({ ids }: { ids: ReadonlyArray<string> }) {
      const normalizedIds = uniqueIds(ids);
      if (normalizedIds.length === 0) {
        return {
          data: [],
          missingIds: [],
        } satisfies BackendAuthOrganizationsResponse;
      }

      const records = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              id: organization.id,
              name: organization.name,
              slug: organization.slug,
              logo: organization.logo,
              metadata: organization.metadata,
              createdAt: organization.createdAt,
            })
            .from(organization)
            .where(inArray(organization.id, normalizedIds)),
        catch: (error) => error,
      });

      const organizations: ReadonlyArray<AuthOrganization> = records.map(
        (record) => ({
          ...record,
          metadata: parseMetadata(record.metadata),
        }),
      );

      return orderedBatch(
        normalizedIds,
        organizations,
      ) satisfies BackendAuthOrganizationsResponse;
    });

    const getOrganization = Effect.fn("BackendAuth.getOrganization")(
      function* ({ id }: { id: string }) {
        const [record] = yield* Effect.tryPromise({
          try: () =>
            db
              .select({
                id: organization.id,
                name: organization.name,
                slug: organization.slug,
                logo: organization.logo,
                metadata: organization.metadata,
                createdAt: organization.createdAt,
              })
              .from(organization)
              .where(eq(organization.id, id))
              .limit(1),
          catch: (error) => error,
        });

        if (!record) return undefined;

        return {
          ...record,
          metadata: parseMetadata(record.metadata),
        } satisfies AuthOrganization;
      },
    );

    return { listUsersByIds, getUser, listOrganizationsByIds, getOrganization };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
