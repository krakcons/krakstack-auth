import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import {
  CurrentActor,
  Forbidden,
  all,
  any,
  defineProjectAccess,
  defineProjectAccessLabels,
  policy,
  withPolicy,
} from "./access.js";

const Access = defineProjectAccess({
  project: "test-project",
  permissions: ["records:read", "records:update", "search:execute"],
  roles: {
    owner: ["records:read", "records:update", "search:execute"],
    member: ["records:read", "search:execute"],
    support: ["records:read"],
  },
  apiKeys: {
    user: ["records:read", "search:execute"],
    organization: ["search:execute"],
  },
});

const AccessLabels = defineProjectAccessLabels(Access, {
  project: "Test project",
  roles: { owner: "Owner", member: "Member", support: "Support" },
  permissions: {
    records: {
      label: "Records",
      actions: { read: "Read", update: "Update" },
    },
    search: {
      label: "Search",
      actions: { execute: "Execute" },
    },
  },
});

const principalLayer = (permissions: ReadonlySet<string>) =>
  Layer.succeed(CurrentActor, {
    actor: {
      type: "user",
      userId: "user-1",
      organizationId: "org-1",
      roles: ["member"],
    },
    organizationId: "org-1",
    permissions,
  });

describe("project access", () => {
  it("preserves localized access labels", () => {
    expect(AccessLabels.permissions.records.label).toBe("Records");
    expect(AccessLabels.permissions.records.actions.read).toBe("Read");
  });

  it("resolves the union of organization role permissions", () => {
    expect(Array.from(Access.permissionsForRoles("member,support"))).toEqual([
      "test-project:records:read",
      "test-project:search:execute",
    ]);
  });

  it("ignores unknown and cross-project API key grants", () => {
    expect(
      Array.from(
        Access.permissionsForGrant({
          "test-project": ["search:execute", "unknown"],
          "other-project": ["records:update"],
        }),
      ),
    ).toEqual(["test-project:search:execute"]);
  });

  it("treats a missing legacy key grant as no permissions", () => {
    const actor = Access.actorForApiKey({
      apiKeyId: "key-1",
      owner: { type: "organization", organizationId: "org-1" },
      grant: null,
    });

    expect(actor.permissions.size).toBe(0);
  });

  it("intersects user key grants with live role permissions", () => {
    expect(
      Array.from(
        Access.permissionsForUserKey({
          roles: "member",
          grant: {
            "test-project": ["records:read", "records:update"],
          },
        }),
      ),
    ).toEqual(["test-project:records:read"]);
  });

  it("does not let the user-key helper exceed the assignable catalog", () => {
    expect(
      Array.from(
        Access.permissionsForUserKey({
          roles: "owner",
          grant: {
            "test-project": ["records:read", "records:update"],
          },
        }),
      ),
    ).toEqual(["test-project:records:read"]);
  });

  it("resolves users and API keys into the same permission context", () => {
    const user = Access.actorForUser({
      userId: "user-1",
      organizationId: "org-1",
      roles: "member",
    });
    const organizationKey = Access.actorForApiKey({
      apiKeyId: "key-1",
      owner: { type: "organization", organizationId: "org-1" },
      grant: { "test-project": ["search:execute"] },
    });

    expect(Array.from(user.permissions)).toEqual([
      "test-project:records:read",
      "test-project:search:execute",
    ]);
    expect(Array.from(organizationKey.permissions)).toEqual([
      "test-project:search:execute",
    ]);
  });

  it("does not let a user key exceed its owner's live role", () => {
    const actor = Access.actorForApiKey({
      apiKeyId: "key-1",
      owner: {
        type: "user",
        userId: "user-1",
        organizationId: "org-1",
        roles: ["support"],
      },
      grant: {
        "test-project": ["records:read", "records:update"],
      },
    });

    expect(Array.from(actor.permissions)).toEqual([
      "test-project:records:read",
    ]);
  });

  it("does not let keys exceed the project's assignable key catalog", () => {
    const actor = Access.actorForApiKey({
      apiKeyId: "key-1",
      owner: { type: "organization", organizationId: "org-1" },
      grant: {
        "test-project": ["search:execute", "records:update"],
      },
    });

    expect(Array.from(actor.permissions)).toEqual([
      "test-project:search:execute",
    ]);
  });

  it.effect("requires a typed project permission", () =>
    Effect.gen(function* () {
      yield* Access.permission("search:execute");
      const result = yield* Access.permission("records:update").pipe(
        Effect.flip,
      );
      expect(result).toBeInstanceOf(Forbidden);
    }).pipe(
      Effect.provide(
        principalLayer(
          new Set(["test-project:records:read", "test-project:search:execute"]),
        ),
      ),
    ),
  );

  it.effect("composes all and any policies", () =>
    Effect.gen(function* () {
      yield* any(
        Access.permission("records:update"),
        Access.permission("records:read"),
      );
      const result = yield* all(
        Access.permission("records:read"),
        Access.permission("records:update"),
      ).pipe(Effect.flip);
      expect(result).toBeInstanceOf(Forbidden);
    }).pipe(
      Effect.provide(principalLayer(new Set(["test-project:records:read"]))),
    ),
  );

  it.effect("runs a policy before the protected effect", () =>
    Effect.gen(function* () {
      let executed = false;
      const denied = Effect.sync(() => {
        executed = true;
      }).pipe(withPolicy(Access.permission("records:update")), Effect.flip);

      yield* denied;
      expect(executed).toBe(false);
    }).pipe(
      Effect.provide(principalLayer(new Set(["test-project:records:read"]))),
    ),
  );

  it.effect("composes attribute policies with permission policies", () =>
    Effect.gen(function* () {
      const sameOrganization = policy((actor) =>
        Effect.succeed(actor.organizationId === "org-1"),
      );
      yield* all(Access.permission("records:read"), sameOrganization);
    }).pipe(
      Effect.provide(principalLayer(new Set(["test-project:records:read"]))),
    ),
  );
});
