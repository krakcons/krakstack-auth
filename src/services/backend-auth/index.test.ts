import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { sqlTestLayer } from "@/services/database";
import { UserMetadata } from "@krak-stack/auth/schema";
import { BackendAuth } from ".";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "BackendAuth user contact metadata",
  () => {
    it.effect(
      "projects metadata through trusted user and member queries",
      () => {
        const userId = `user-${crypto.randomUUID()}`;
        const organizationId = `organization-${crypto.randomUUID()}`;
        const memberId = `member-${crypto.randomUUID()}`;
        const metadata = Schema.decodeUnknownSync(UserMetadata)({
          emails: [
            {
              email: "ada@example.com",
              translations: [
                { locale: "en", label: "Work" },
                { locale: "fr", label: "Travail" },
              ],
            },
          ],
          phones: [
            {
              number: "+1 514 555 0100",
              translations: [{ locale: "en", label: "Mobile" }],
            },
          ],
        });

        return Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const backendAuth = yield* BackendAuth;
          const createdAt = new Date();

          yield* sql`INSERT INTO "user" (id, name, email, email_verified, metadata)
            VALUES (${userId}, 'Ada Lovelace', ${`${userId}@example.com`}, true,
              ${Schema.encodeSync(Schema.fromJsonString(UserMetadata))(metadata)}::jsonb)`;
          yield* sql`INSERT INTO organization ${sql.insert({
            id: organizationId,
            name: "Example Organization",
            slug: organizationId,
            userId,
            createdAt,
          })}`;
          yield* sql`INSERT INTO member ${sql.insert({
            id: memberId,
            organizationId,
            userId,
            role: "owner",
            createdAt,
          })}`;

          const singleUser = yield* backendAuth.getUser({ id: userId });
          const users = yield* backendAuth.listUsersByIds({
            ids: [userId, "missing-user"],
          });
          const activeMember = yield* backendAuth.getActiveMember({
            organizationId,
            userId,
          });
          const members = yield* backendAuth.listOrganizationMembers({
            organizationId,
          });

          expect(singleUser?.metadata).toEqual(metadata);
          expect(users.data[0]?.metadata).toEqual(metadata);
          expect(users.missingIds).toEqual(["missing-user"]);
          expect(activeMember?.user.metadata).toEqual(metadata);
          expect(members[0]?.user.metadata).toEqual(metadata);

          // Simulate historical JSON that is no longer accepted for new writes.
          // Keep valid contact groups while dropping incompatible ones.
          const legacyMetadata = {
            emails: [{ email: "legacy@example.com", label: "Work" }],
            phones: metadata.phones,
          };
          const persistedMetadataJson = Schema.fromJsonString(
            Schema.Struct({
              emails: Schema.Array(
                Schema.Struct({ email: Schema.String, label: Schema.String }),
              ),
              phones: UserMetadata.fields.phones,
            }),
          );
          yield* sql`UPDATE "user" SET metadata = ${Schema.encodeSync(persistedMetadataJson)(legacyMetadata)}::jsonb WHERE id = ${userId}`;
          const normalized = { phones: metadata.phones };
          expect(
            (yield* backendAuth.getUser({ id: userId }))?.metadata,
          ).toEqual(normalized);
          const legacyUsers = yield* backendAuth.listUsersByIds({
            ids: [userId, "missing-user"],
          });
          expect(legacyUsers.data[0]?.metadata).toEqual(normalized);
          expect(legacyUsers.missingIds).toEqual(["missing-user"]);
          expect(
            (yield* backendAuth.getActiveMember({ organizationId, userId }))
              ?.user.metadata,
          ).toEqual(normalized);
          expect(
            (yield* backendAuth.listOrganizationMembers({ organizationId }))[0]
              ?.user.metadata,
          ).toEqual(normalized);
        }).pipe(
          Effect.ensuring(
            Effect.gen(function* () {
              const sql = yield* SqlClient.SqlClient;
              yield* sql`DELETE FROM "user" WHERE id = ${userId}`;
            }).pipe(Effect.orDie),
          ),
          Effect.provide(BackendAuth.layer),
          Effect.provide(sqlTestLayer),
        );
      },
    );
  },
);
