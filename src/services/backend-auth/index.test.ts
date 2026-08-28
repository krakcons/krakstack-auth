import { describe, expect, it } from "@effect/vitest";
import { eq } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { member, organization, user } from "@/db/schema";
import { DB } from "@/services/database";
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
          const db = yield* DB;
          const backendAuth = yield* BackendAuth;
          const createdAt = new Date();

          yield* db.insert(user).values({
            id: userId,
            name: "Ada Lovelace",
            email: `${userId}@example.com`,
            emailVerified: true,
            metadata,
          });
          yield* db.insert(organization).values({
            id: organizationId,
            name: "Example Organization",
            slug: organizationId,
            userId,
            createdAt,
          });
          yield* db.insert(member).values({
            id: memberId,
            organizationId,
            userId,
            role: "owner",
            createdAt,
          });

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
        }).pipe(
          Effect.ensuring(
            Effect.gen(function* () {
              const db = yield* DB;
              yield* db.delete(user).where(eq(user.id, userId));
            }).pipe(Effect.orDie),
          ),
          Effect.provide(BackendAuth.layer),
          Effect.provide(DB.testLayer),
        );
      },
    );
  },
);
