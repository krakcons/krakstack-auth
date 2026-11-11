import * as Layer from "effect/Layer";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

import { sqlTestLayer } from "@/services/database";
import { UserMetadata } from "@krak-stack/auth/schema";
import { BackendAuth } from ".";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "BackendAuth user contact metadata",
  () => {
    it.effect("returns email batches in normalized request order", () => {
      const firstId = crypto.randomUUID();
      const secondId = crypto.randomUUID();
      const firstEmail = `${firstId}@example.com`;
      const secondEmail = `${secondId}@example.com`;
      return Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const backendAuth = yield* BackendAuth;
        yield* sql`INSERT INTO "user" (id, name, email, email_verified, locale) VALUES
          (${firstId}, 'First', ${firstEmail}, true, 'en'),
          (${secondId}, 'Second', ${secondEmail.toUpperCase()}, true, 'fr')`;
        const result = yield* backendAuth.listUsersByEmails({
          emails: [secondEmail, firstEmail, secondEmail.toUpperCase()],
        });
        expect(result.data.map(({ id, locale }) => ({ id, locale }))).toEqual([
          { id: secondId, locale: "fr" },
          { id: firstId, locale: "en" },
        ]);
        expect(result.missingEmails).toEqual([]);
      }).pipe(
        Effect.ensuring(
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            yield* sql`DELETE FROM "user" WHERE ${sql.in("id", [firstId, secondId])}`;
          }).pipe(Effect.orDie),
        ),
        Effect.provide(
          BackendAuth.layer.pipe(Layer.provideMerge(sqlTestLayer)),
        ),
      );
    });

    it.effect(
      "projects metadata through trusted user and member queries",
      () => {
        const userId = `user-${crypto.randomUUID()}`;
        const organizationId = `organization-${crypto.randomUUID()}`;
        const memberId = `member-${crypto.randomUUID()}`;
        const metadata = Schema.decodeSync(UserMetadata)({
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

          yield* sql`INSERT INTO "user" (id, name, email, email_verified, locale, metadata)
            VALUES (${userId}, 'Ada Lovelace', ${`${userId}@example.com`}, true, 'fr',
              ${yield* Schema.encodeEffect(Schema.fromJsonString(UserMetadata))(metadata).pipe(Effect.orDie)}::jsonb)`;
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
          const emailUsers = yield* backendAuth.listUsersByEmails({
            emails: [
              ` ${userId.toUpperCase()}@EXAMPLE.COM `,
              `missing-${userId}@example.com`,
              `${userId}@example.com`,
              " ",
            ],
          });
          expect(emailUsers.data).toHaveLength(1);
          expect(emailUsers.data[0]?.id).toBe(userId);
          expect(emailUsers.data[0]?.locale).toBe("fr");
          expect(emailUsers.data[0]?.metadata).toEqual(metadata);
          expect(emailUsers.missingEmails).toEqual([
            `missing-${userId}@example.com`,
          ]);
          expect(yield* backendAuth.listUsersByEmails({ emails: [] })).toEqual({
            data: [],
            missingEmails: [],
          });
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
          expect(singleUser?.locale).toBe("fr");
          expect(users.data[0]?.locale).toBe("fr");
          expect(activeMember?.user.locale).toBe("fr");
          expect(members[0]?.user.locale).toBe("fr");
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
          yield* sql`UPDATE "user" SET metadata = ${yield* Schema.encodeEffect(persistedMetadataJson)(legacyMetadata).pipe(Effect.orDie)}::jsonb WHERE id = ${userId}`;
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
          Effect.provide(
            BackendAuth.layer.pipe(Layer.provideMerge(sqlTestLayer)),
          ),
        );
      },
    );
  },
);
