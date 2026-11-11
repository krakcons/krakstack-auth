import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer, Schema } from "effect";
import { DirectNotificationDispatcher } from "@krak-stack/notifications/direct";
import { makeFakeTransport } from "@krak-stack/notifications/testing";
import { NotificationTransportPermanent } from "@krak-stack/notifications/transport";
import {
  EmailPayloadV1,
  formatEmailRecipient,
} from "@krak-stack/notifications/transport/email";
import { vi } from "vitest";
import { m } from "@/paraglide/messages";
import { AuthEmailKind } from "@/services/auth-emails/schema";
import { brandingEmailSender } from "@/services/auth/email-sender";

describe("authentication email sender", () => {
  it.effect(
    "normalizes branding names before dispatch without losing punctuation",
    () =>
      Effect.gen(function* () {
        const { sendNotificationEmail } = yield* Effect.promise(
          () => import("./notification.server"),
        );
        const transport = makeFakeTransport({ channel: "email" });
        const sender = brandingEmailSender({
          name: ' \r\n(PROD) Test\r\n "Team" \\ 1\r\n ',
          domain: "example.test",
          fallbackName: "Auth",
        });
        yield* sendNotificationEmail({
          ...sender,
          to: "user@example.test",
          subject: "Sign in",
          text: "000000",
        }).pipe(
          Effect.provide(
            DirectNotificationDispatcher.layer.pipe(
              Layer.provide(transport.layer),
            ),
          ),
        );
        expect(transport.sent[0]?.payload).toMatchObject({
          from: "noreply@example.test",
          fromName: '(PROD) Test "Team" \\ 1',
        });
        expect(
          brandingEmailSender({
            name: "\r\n ",
            domain: "example.test",
            fallbackName: "Auth\r\n",
          }).fromName,
        ).toBe("Auth");
        expect(
          brandingEmailSender({
            name: "\r\n",
            domain: "example.test",
            fallbackName: "\n ",
          }).fromName,
        ).toBe("Krakstack Auth");
      }),
  );

  it.effect("quotes and escapes organization sender names", () =>
    Effect.gen(function* () {
      const { sendNotificationEmail } = yield* Effect.promise(
        () => import("./notification.server"),
      );
      const transport = makeFakeTransport({ channel: "email" });
      yield* sendNotificationEmail({
        to: "user@example.test",
        from: "noreply@example.test",
        fromName: "(PROD) Test Team 1",
        subject: "Sign in",
        text: "000000",
      }).pipe(
        Effect.provide(
          DirectNotificationDispatcher.layer.pipe(
            Layer.provide(transport.layer),
          ),
        ),
      );
      const email = yield* Schema.decodeUnknownEffect(EmailPayloadV1)(
        transport.sent[0]?.payload,
      );
      expect(email.fromName).toBe("(PROD) Test Team 1");
      expect(
        formatEmailRecipient({
          address: email.from!,
          name: email.fromName ?? null,
        }),
      ).toBe('"(PROD) Test Team 1" <noreply@example.test>');
      expect(
        formatEmailRecipient({
          address: "noreply@example.test",
          name: 'Team "One" \\ Support',
        }),
      ).toBe('"Team \\"One\\" \\\\ Support" <noreply@example.test>');
    }),
  );

  it.effect(
    "renders non-authenticating localized samples for every email type",
    () =>
      Effect.gen(function* () {
        const { previewProjectAuthEmail } = yield* Effect.promise(
          () => import("./email.server"),
        );
        const project = {
          id: "preview-project",
          name: "Preview project",
          logo: null,
          data: {},
          createdAt: new Date("2026-11-05T00:00:00.000Z"),
          updatedAt: new Date("2026-11-05T00:00:00.000Z"),
        };
        for (const locale of ["en", "fr"] satisfies Array<"en" | "fr">) {
          for (const kind of AuthEmailKind.literals) {
            const preview = yield* previewProjectAuthEmail({
              project,
              origin: "https://auth.example.test",
              payload: { kind, locale, settings: {} },
            });
            for (const output of [preview.html, preview.text]) {
              expect(output).toContain(
                m.auth_email_test_notice({}, { locale }),
              );
              expect(output).toContain(
                kind === "reset-password"
                  ? "https://example.invalid/reset-password"
                  : "000000",
              );
            }
          }
        }
      }),
  );

  it.effect(
    "uses a nonempty default sender when sender settings are blank",
    () =>
      Effect.gen(function* () {
        vi.resetModules();
        const transport = makeFakeTransport({ channel: "email" });
        const notifications = DirectNotificationDispatcher.layer.pipe(
          Layer.provide(transport.layer),
        );
        vi.stubEnv("AUTH_EMAIL_FROM", "");
        vi.stubEnv("NOTIFICATION_EMAIL_FROM", "   ");
        vi.stubEnv("AUTH_EMAIL_NAME", "   ");
        yield* Effect.addFinalizer(() => Effect.sync(() => vi.unstubAllEnvs()));
        const { sendProjectAuthEmailTest } = yield* Effect.promise(
          () => import("./email.server"),
        );
        yield* sendProjectAuthEmailTest({
          to: "admin@example.test",
          email: {
            subject: "Sign in",
            text: "Sample only: 000000",
            html: "<p>Sample only: 000000</p>",
          },
          locale: "en",
        }).pipe(Effect.provide(notifications));
        expect(transport.sent).toHaveLength(1);
        const email = yield* Schema.decodeUnknownEffect(EmailPayloadV1)(
          transport.sent[0]?.payload,
        );
        expect(email.from).toBe("no-reply@krakstack.local");
        expect(email.fromName).toBe("Krakstack Auth");
        expect(transport.sent[0]?.recipientAddress).toBe("admin@example.test");
      }).pipe(Effect.scoped),
  );

  const senderCases = [
    {
      name: "preserves plain Unicode sender names for transport encoding",
      from: "Équipe Française <auth@example.test>",
      notificationFrom: undefined,
      appName: "Example",
      expected: { from: "auth@example.test", fromName: "Équipe Française" },
    },
    {
      name: "decodes a quoted legacy sender name",
      from: '"Team \\"One\\" \\\\ Support" <auth@example.test>',
      notificationFrom: undefined,
      appName: "Example",
      expected: {
        from: "auth@example.test",
        fromName: 'Team "One" \\ Support',
      },
    },
    {
      name: "preserves parentheses in the sender display name",
      from: "(PROD) Test Team 1 <auth@example.test>",
      notificationFrom: undefined,
      appName: "Example",
      expected: { from: "auth@example.test", fromName: "(PROD) Test Team 1" },
    },
    {
      name: "accepts a bare sender address",
      from: "auth@example.test",
      notificationFrom: undefined,
      appName: "Example",
      expected: { from: "auth@example.test" },
    },
    {
      name: "accepts a sender mailbox without a display name",
      from: "<auth@example.test>",
      notificationFrom: undefined,
      appName: "Example",
      expected: { from: "auth@example.test" },
    },
    {
      name: "prefers the authentication sender and trims whitespace",
      from: "  Auth <auth@example.test>  ",
      notificationFrom: "Notify <notify@example.test>",
      appName: "Example",
      expected: { from: "auth@example.test", fromName: "Auth" },
    },
    {
      name: "inherits the notification sender when the authentication sender is blank",
      from: "  ",
      notificationFrom: "  Notify <notify@example.test>  ",
      appName: "Example",
      expected: { from: "notify@example.test", fromName: "Notify" },
    },
    {
      name: "inherits the notification sender when the authentication sender is absent",
      from: undefined,
      notificationFrom: "Notify <notify@example.test>",
      appName: "Example",
      expected: { from: "notify@example.test", fromName: "Notify" },
    },
    {
      name: "uses the configured app name when neither sender is configured",
      from: undefined,
      notificationFrom: undefined,
      appName: "  Example  ",
      expected: { from: "no-reply@krakstack.local", fromName: "Example" },
    },
  ];
  for (const scenario of senderCases) {
    it.effect(scenario.name, () =>
      Effect.gen(function* () {
        vi.resetModules();
        vi.stubEnv("AUTH_EMAIL_FROM", scenario.from);
        vi.stubEnv("NOTIFICATION_EMAIL_FROM", scenario.notificationFrom);
        vi.stubEnv("AUTH_EMAIL_NAME", scenario.appName);
        yield* Effect.addFinalizer(() => Effect.sync(() => vi.unstubAllEnvs()));
        const { sendProjectAuthEmailTest } = yield* Effect.promise(
          () => import("./email.server"),
        );
        const transport = makeFakeTransport({ channel: "email" });
        const notifications = DirectNotificationDispatcher.layer.pipe(
          Layer.provide(transport.layer),
        );
        yield* sendProjectAuthEmailTest({
          to: "admin@example.test",
          locale: "fr",
          email: { subject: "Subject", html: "<p>Sample</p>", text: "Sample" },
        }).pipe(Effect.provide(notifications));
        expect(transport.sent).toHaveLength(1);
        expect(transport.sent[0]?.recipientAddress).toBe("admin@example.test");
        expect(transport.sent[0]?.payload).toEqual({
          ...scenario.expected,
          subject: "[TEST] Subject",
          html: "<p>Sample</p>",
          text: "Sample",
        });
      }).pipe(Effect.scoped),
    );
  }

  it.effect("rejects sender header injection before dispatch", () =>
    Effect.gen(function* () {
      const { sendNotificationEmail } = yield* Effect.promise(
        () => import("./notification.server"),
      );
      const transport = makeFakeTransport({ channel: "email" });
      const result = yield* sendNotificationEmail({
        to: "user@example.test",
        from: "auth@example.test",
        fromName: "Team\r\nBcc: attacker@example.test",
        subject: "Sign in",
        text: "000000",
      }).pipe(
        Effect.provide(
          DirectNotificationDispatcher.layer.pipe(
            Layer.provide(transport.layer),
          ),
        ),
        Effect.exit,
      );
      expect(Exit.isFailure(result)).toBe(true);
      expect(transport.sent).toHaveLength(0);
    }),
  );

  it.effect(
    "propagates delivery failures instead of reporting a successful test",
    () =>
      Effect.gen(function* () {
        const { sendProjectAuthEmailTest } = yield* Effect.promise(
          () => import("./email.server"),
        );
        const failure = new NotificationTransportPermanent({
          channel: "email",
          message: "Delivery rejected",
        });
        const transport = makeFakeTransport({
          channel: "email",
          send: () => Effect.fail(failure),
        });
        const notifications = DirectNotificationDispatcher.layer.pipe(
          Layer.provide(transport.layer),
        );
        const error = yield* sendProjectAuthEmailTest({
          to: "admin@example.test",
          locale: "en",
          email: { subject: "Sample", html: "<p>Sample</p>", text: "Sample" },
        }).pipe(Effect.provide(notifications), Effect.flip);
        expect(error).toBe(failure);
      }),
  );
});
