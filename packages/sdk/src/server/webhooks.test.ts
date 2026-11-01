import { describe, expect, it } from "@effect/vitest";
import { Effect, Redacted, Schema } from "effect";
import { WebhooksReceiver } from "@krak-stack/registry/webhooks";
import { receiveAuthWebhook } from "./webhooks.js";

// Signature verification and receipt persistence belong to the registry. This
// adapter isolates Auth's event-specific validation and handler routing.
const receiver = WebhooksReceiver.of({
  receive: (input) =>
    Schema.decodeUnknownEffect(Schema.fromJsonString(input.schema))(
      input.body,
    ).pipe(Effect.flatMap(input.handle), Effect.as({ duplicate: false })),
  cleanup: () => Effect.void,
});

const data = {
  projectId: "project",
  organizationId: "organization",
  scope: "organization",
};

describe("Organization deletion webhook routing", () => {
  it.effect("routes user deletion only to user cleanup", () =>
    Effect.gen(function* () {
      const received: string[] = [];
      yield* receiveAuthWebhook({
        projectId: "project",
        secret: Redacted.make("test-secret"),
        headers: {},
        body: JSON.stringify({
          event: "user.deletion_requested",
          data: {
            projectId: "project",
            userId: "user",
            scope: "account",
          },
        }),
        onDeleteUser: ({ userId }) =>
          Effect.sync(() => {
            received.push(userId);
          }),
        onDeleteOrganization: () =>
          Effect.die("Must not delete an organization"),
        onWebhook: () => Effect.die("Must not use the generic handler"),
      });
      expect(received).toEqual(["user"]);
    }).pipe(Effect.provideService(WebhooksReceiver, receiver)),
  );
  it.effect(
    "validates organization cleanup and routes it without invoking user cleanup",
    () =>
      Effect.gen(function* () {
        const received: string[] = [];
        yield* receiveAuthWebhook({
          projectId: "project",
          secret: Redacted.make("test-secret"),
          headers: {},
          body: JSON.stringify({
            event: "organization.deletion_requested",
            data,
          }),
          onDeleteUser: () => Effect.die("Must not delete a user"),
          onDeleteOrganization: (organization) =>
            Effect.sync(() => {
              received.push(organization.organizationId);
            }),
          onWebhook: () => Effect.die("Must not use the generic handler"),
        });
        expect(received).toEqual(["organization"]);
      }).pipe(Effect.provideService(WebhooksReceiver, receiver)),
  );

  it.effect(
    "rejects malformed organization cleanup before calling the app",
    () =>
      Effect.gen(function* () {
        let called = false;
        const result = yield* receiveAuthWebhook({
          projectId: "project",
          secret: Redacted.make("test-secret"),
          headers: {},
          body: JSON.stringify({
            event: "organization.deletion_requested",
            data: { ...data, organizationId: "", scope: "account" },
          }),
          onDeleteUser: () => Effect.die("Must not delete a user"),
          onDeleteOrganization: () =>
            Effect.sync(() => {
              called = true;
            }),
        }).pipe(Effect.result);
        expect(result).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "WebhookVerificationError", reason: "payload" },
        });
        expect(called).toBe(false);
      }).pipe(Effect.provideService(WebhooksReceiver, receiver)),
  );

  it.effect(
    "propagates organization cleanup failures without using the generic handler",
    () =>
      Effect.gen(function* () {
        const result = yield* receiveAuthWebhook({
          projectId: "project",
          secret: Redacted.make("test-secret"),
          headers: {},
          body: JSON.stringify({
            event: "organization.deletion_requested",
            data,
          }),
          onDeleteUser: () => Effect.die("Must not delete a user"),
          onDeleteOrganization: () => Effect.fail("cleanup failed"),
          onWebhook: () => Effect.die("Must not use the generic handler"),
        }).pipe(Effect.result);
        expect(result).toMatchObject({
          _tag: "Failure",
          failure: "cleanup failed",
        });
      }).pipe(Effect.provideService(WebhooksReceiver, receiver)),
  );
});
