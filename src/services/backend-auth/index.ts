import { Context, Effect, Layer } from "effect";
import { and, desc, eq, gt, inArray, isNotNull } from "drizzle-orm";

import {
  member,
  organization,
  session as authSession,
  user,
} from "@/db/schema";
import type { AuthOrganization } from "@/lib/auth-schema";
import { db } from "@/services/database";
import type {
  BackendAuthActiveOrganization,
  BackendAuthMembersResponse,
  BackendAuthOrganizationsResponse,
  BackendAuthUsersResponse,
} from "./schema";

type MemberRecord = BackendAuthMembersResponse[number];
type MemberRow = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
  userIdField: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  userRole: string | null;
  banned: boolean | null;
  userCreatedAt: Date;
  userUpdatedAt: Date;
};

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

const selectMemberColumns = () => ({
  id: member.id,
  organizationId: member.organizationId,
  userId: member.userId,
  role: member.role,
  createdAt: member.createdAt,
  userIdField: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  image: user.image,
  userRole: user.role,
  banned: user.banned,
  userCreatedAt: user.createdAt,
  userUpdatedAt: user.updatedAt,
});

const memberRecord = (record: MemberRow): MemberRecord => ({
  id: record.id,
  organizationId: record.organizationId,
  userId: record.userId,
  role: record.role,
  createdAt: record.createdAt,
  user: {
    id: record.userIdField,
    name: record.name,
    email: record.email,
    emailVerified: record.emailVerified,
    image: record.image,
    role: record.userRole,
    banned: record.banned,
    createdAt: record.userCreatedAt,
    updatedAt: record.userUpdatedAt,
  },
});

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

    const listOrganizationsByUserId = Effect.fn(
      "BackendAuth.listOrganizationsByUserId",
    )(function* ({ userId }: { userId: string }) {
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
            .from(member)
            .innerJoin(organization, eq(member.organizationId, organization.id))
            .where(eq(member.userId, userId)),
        catch: (error) => error,
      });

      return {
        data: records.map((record) => ({
          ...record,
          metadata: parseMetadata(record.metadata),
        })),
        missingIds: [],
      } satisfies BackendAuthOrganizationsResponse;
    });

    const getUserActiveOrganization = Effect.fn(
      "BackendAuth.getUserActiveOrganization",
    )(function* ({ userId }: { userId: string }) {
      const [activeSession] = yield* Effect.tryPromise({
        try: () =>
          db
            .select({ id: authSession.activeOrganizationId })
            .from(authSession)
            .where(
              and(
                eq(authSession.userId, userId),
                isNotNull(authSession.activeOrganizationId),
                gt(authSession.expiresAt, new Date()),
              ),
            )
            .orderBy(desc(authSession.updatedAt), desc(authSession.createdAt))
            .limit(1),
        catch: (error) => error,
      });

      return {
        id: activeSession?.id ?? null,
      } satisfies BackendAuthActiveOrganization;
    });

    const getActiveMember = Effect.fn("BackendAuth.getActiveMember")(
      function* ({
        organizationId,
        userId,
      }: {
        organizationId: string;
        userId: string;
      }) {
        const [record] = yield* Effect.tryPromise({
          try: () =>
            db
              .select(selectMemberColumns())
              .from(member)
              .innerJoin(user, eq(member.userId, user.id))
              .where(
                and(
                  eq(member.organizationId, organizationId),
                  eq(member.userId, userId),
                ),
              )
              .limit(1),
          catch: (error) => error,
        });

        return record ? memberRecord(record) : undefined;
      },
    );

    const listOrganizationMembers = Effect.fn(
      "BackendAuth.listOrganizationMembers",
    )(function* ({ organizationId }: { organizationId: string }) {
      const records = yield* Effect.tryPromise({
        try: () =>
          db
            .select(selectMemberColumns())
            .from(member)
            .innerJoin(user, eq(member.userId, user.id))
            .where(eq(member.organizationId, organizationId)),
        catch: (error) => error,
      });

      return records.map(memberRecord) satisfies BackendAuthMembersResponse;
    });

    return {
      listUsersByIds,
      getUser,
      listOrganizationsByIds,
      listOrganizationsByUserId,
      getOrganization,
      getUserActiveOrganization,
      getActiveMember,
      listOrganizationMembers,
    };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
