import { Context, Effect, Layer, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";

import { OrganizationRow, UserRow } from "@/db/schema";
import {
  BackendAuthActiveOrganization,
  BackendAuthMemberParams,
} from "./schema";

const BackendUserRow = Schema.Struct({
  id: UserRow.fields.id,
  name: UserRow.fields.name,
  email: UserRow.fields.email,
  emailVerified: UserRow.fields.emailVerified,
  image: UserRow.fields.image,
  metadata: UserRow.fields.metadata,
  role: UserRow.fields.role,
  banned: UserRow.fields.banned,
  createdAt: UserRow.fields.createdAt,
  updatedAt: UserRow.fields.updatedAt,
}).annotate({ identifier: "BackendUserRow" });

const BackendOrganizationRow = Schema.Struct({
  id: OrganizationRow.fields.id,
  name: OrganizationRow.fields.name,
  slug: OrganizationRow.fields.slug,
  logo: OrganizationRow.fields.logo,
  metadata: OrganizationRow.fields.metadata,
  parentId: OrganizationRow.fields.parentId,
  createdAt: OrganizationRow.fields.createdAt,
}).annotate({ identifier: "BackendOrganizationRow" });

const MemberRow = Schema.Struct({
  id: Schema.String,
  organizationId: Schema.String,
  userId: Schema.String,
  role: Schema.String,
  createdAt: Schema.Date,
  userIdField: Schema.String,
  name: Schema.String,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String),
  metadata: UserRow.fields.metadata,
  userRole: Schema.NullOr(Schema.String),
  banned: Schema.NullOr(Schema.Boolean),
  userCreatedAt: Schema.Date,
  userUpdatedAt: Schema.Date,
}).annotate({ identifier: "BackendMemberRow" });

const parseMetadata = (value: string | null) =>
  value
    ? Option.getOrElse(
        Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Json))(value),
        () => value,
      )
    : null;

const organizationRecord = (record: typeof BackendOrganizationRow.Type) => ({
  ...record,
  metadata: parseMetadata(record.metadata),
});

const memberRecord = (record: typeof MemberRow.Type) => ({
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
    metadata: record.metadata,
    role: record.userRole,
    banned: record.banned,
    createdAt: record.userCreatedAt,
    updatedAt: record.userUpdatedAt,
  },
});

const uniqueIds = (ids: ReadonlyArray<string>) =>
  Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

const orderedBatch = <A extends { id: string }>(
  ids: ReadonlyArray<string>,
  records: ReadonlyArray<A>,
) => {
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    data: ids.flatMap((id) => {
      const record = byId.get(id);
      return record ? [record] : [];
    }),
    missingIds: ids.filter((id) => !byId.has(id)),
  };
};

export class BackendAuth extends Context.Service<BackendAuth>()("BackendAuth", {
  make: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const userById = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: BackendUserRow,
      execute: (id) => sql`SELECT * FROM "user" WHERE id = ${id} LIMIT 1`,
    });
    const usersByIds = SqlSchema.findAll({
      Request: Schema.Array(Schema.String),
      Result: BackendUserRow,
      execute: (ids) => sql`SELECT * FROM "user" WHERE ${sql.in("id", ids)}`,
    });
    const organizationById = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: BackendOrganizationRow,
      execute: (id) => sql`SELECT * FROM organization WHERE id = ${id} LIMIT 1`,
    });
    const organizationsByIds = SqlSchema.findAll({
      Request: Schema.Array(Schema.String),
      Result: BackendOrganizationRow,
      execute: (ids) =>
        sql`SELECT * FROM organization WHERE ${sql.in("id", ids)}`,
    });
    const children = SqlSchema.findAll({
      Request: Schema.String,
      Result: BackendOrganizationRow,
      execute: (id) => sql`SELECT * FROM organization WHERE parent_id = ${id}`,
    });
    const organizationsByUser = SqlSchema.findAll({
      Request: Schema.String,
      Result: BackendOrganizationRow,
      execute: (id) =>
        sql`SELECT o.* FROM organization o INNER JOIN member m ON m.organization_id = o.id WHERE m.user_id = ${id}`,
    });
    const activeOrganization = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: BackendAuthActiveOrganization,
      execute: (id) => sql`SELECT active_organization_id AS id FROM session
        WHERE user_id = ${id} AND active_organization_id IS NOT NULL AND expires_at > ${new Date()}
        ORDER BY updated_at DESC, created_at DESC LIMIT 1`,
    });
    const memberColumns = sql`m.id, m.organization_id, m.user_id, m.role, m.created_at,
      u.id AS user_id_field, u.name, u.email, u.email_verified, u.image, u.metadata,
      u.role AS user_role, u.banned, u.created_at AS user_created_at, u.updated_at AS user_updated_at`;
    const activeMember = SqlSchema.findOneOption({
      Request: BackendAuthMemberParams,
      Result: MemberRow,
      execute: ({ organizationId, userId }) => sql`SELECT ${memberColumns}
        FROM member m INNER JOIN "user" u ON u.id = m.user_id
        WHERE m.organization_id = ${organizationId} AND m.user_id = ${userId} LIMIT 1`,
    });
    const members = SqlSchema.findAll({
      Request: Schema.String,
      Result: MemberRow,
      execute: (id) =>
        sql`SELECT ${memberColumns} FROM member m INNER JOIN "user" u ON u.id = m.user_id WHERE m.organization_id = ${id}`,
    });

    const listUsersByIds = Effect.fn("BackendAuth.listUsersByIds")(function* ({
      ids,
    }: {
      ids: ReadonlyArray<string>;
    }) {
      const normalizedIds = uniqueIds(ids);
      return orderedBatch(
        normalizedIds,
        normalizedIds.length ? yield* usersByIds(normalizedIds) : [],
      );
    });
    const getUser = Effect.fn("BackendAuth.getUser")(function* ({
      id,
    }: {
      id: string;
    }) {
      return Option.getOrUndefined(yield* userById(id));
    });
    const listOrganizationsByIds = Effect.fn(
      "BackendAuth.listOrganizationsByIds",
    )(function* ({ ids }: { ids: ReadonlyArray<string> }) {
      const normalizedIds = uniqueIds(ids);
      const records = normalizedIds.length
        ? yield* organizationsByIds(normalizedIds)
        : [];
      return orderedBatch(normalizedIds, records.map(organizationRecord));
    });
    const getOrganization = Effect.fn("BackendAuth.getOrganization")(
      function* ({ id }: { id: string }) {
        return Option.getOrUndefined(
          Option.map(yield* organizationById(id), organizationRecord),
        );
      },
    );
    const getOrganizationChildren = Effect.fn(
      "BackendAuth.getOrganizationChildren",
    )(function* ({ organizationId }: { organizationId: string }) {
      return (yield* children(organizationId)).map(organizationRecord);
    });
    const listOrganizationsByUserId = Effect.fn(
      "BackendAuth.listOrganizationsByUserId",
    )(function* ({ userId }: { userId: string }) {
      return {
        data: (yield* organizationsByUser(userId)).map(organizationRecord),
        missingIds: [],
      };
    });
    const getUserActiveOrganization = Effect.fn(
      "BackendAuth.getUserActiveOrganization",
    )(function* ({ userId }: { userId: string }) {
      return Option.getOrElse(yield* activeOrganization(userId), () => ({
        id: null,
      }));
    });
    const getActiveMember = Effect.fn("BackendAuth.getActiveMember")(function* (
      input: typeof BackendAuthMemberParams.Type,
    ) {
      return Option.getOrUndefined(
        Option.map(yield* activeMember(input), memberRecord),
      );
    });
    const listOrganizationMembers = Effect.fn(
      "BackendAuth.listOrganizationMembers",
    )(function* ({ organizationId }: { organizationId: string }) {
      return (yield* members(organizationId)).map(memberRecord);
    });
    return {
      listUsersByIds,
      getUser,
      listOrganizationsByIds,
      listOrganizationsByUserId,
      getOrganization,
      getOrganizationChildren,
      getUserActiveOrganization,
      getActiveMember,
      listOrganizationMembers,
    };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
