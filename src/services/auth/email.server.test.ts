import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SesEmailNotification } from "@krak-stack/registry/notification-channel-email-ses/schema";
import { NotificationService } from "@krak-stack/registry/service-notification";
import { NotificationSendError } from "@krak-stack/registry/service-notification/schema";
import { vi } from "vitest";
import { m } from "@/paraglide/messages";
import { AuthEmailKind } from "@/services/auth-emails/schema";

describe("authentication email sender", () => {
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
        const sentEmails: Array<unknown> = [];
        const notifications = NotificationService.makeLayer([
          {
            key: "email",
            send: (email) =>
              Effect.sync(() => {
                sentEmails.push(email);
              }),
          },
        ]);
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
        expect(sentEmails).toHaveLength(1);
        const email = yield* Schema.decodeUnknownEffect(SesEmailNotification)(
          sentEmails[0],
        );
        expect(email.from).toBe("Krakstack Auth <no-reply@krakstack.local>");
        expect(email.to).toBe("admin@example.test");
      }).pipe(Effect.scoped),
  );

  const senderCases = [
    {
      name: "prefers the authentication sender and trims whitespace",
      from: "  Auth <auth@example.test>  ",
      notificationFrom: "Notify <notify@example.test>",
      appName: "Example",
      expected: "Auth <auth@example.test>",
    },
    {
      name: "inherits the notification sender when the authentication sender is blank",
      from: "  ",
      notificationFrom: "  Notify <notify@example.test>  ",
      appName: "Example",
      expected: "Notify <notify@example.test>",
    },
    {
      name: "inherits the notification sender when the authentication sender is absent",
      from: undefined,
      notificationFrom: "Notify <notify@example.test>",
      appName: "Example",
      expected: "Notify <notify@example.test>",
    },
    {
      name: "uses the configured app name when neither sender is configured",
      from: undefined,
      notificationFrom: undefined,
      appName: "  Example  ",
      expected: "Example <no-reply@krakstack.local>",
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
        const sent: Array<SesEmailNotification> = [];
        const notifications = NotificationService.makeLayer([
          {
            key: "email",
            send: (payload) =>
              Schema.decodeUnknownEffect(SesEmailNotification)(payload).pipe(
                Effect.orDie,
                Effect.tap((email) =>
                  Effect.sync(() => {
                    sent.push(email);
                  }),
                ),
                Effect.asVoid,
              ),
          },
        ]);
        yield* sendProjectAuthEmailTest({
          to: "admin@example.test",
          locale: "fr",
          email: { subject: "Subject", html: "<p>Sample</p>", text: "Sample" },
        }).pipe(Effect.provide(notifications));
        expect(sent).toEqual([
          {
            from: scenario.expected,
            to: "admin@example.test",
            subject: "[TEST] Subject",
            html: "<p>Sample</p>",
            text: "Sample",
          },
        ]);
      }).pipe(Effect.scoped),
    );
  }

  it.effect(
    "propagates delivery failures instead of reporting a successful test",
    () =>
      Effect.gen(function* () {
        const { sendProjectAuthEmailTest } = yield* Effect.promise(
          () => import("./email.server"),
        );
        const failure = new NotificationSendError({
          channel: "email",
          message: "Delivery rejected",
        });
        const notifications = NotificationService.makeLayer([
          { key: "email", send: () => Effect.fail(failure) },
        ]);
        const error = yield* sendProjectAuthEmailTest({
          to: "admin@example.test",
          locale: "en",
          email: { subject: "Sample", html: "<p>Sample</p>", text: "Sample" },
        }).pipe(Effect.provide(notifications), Effect.flip);
        expect(error).toBe(failure);
      }),
  );
});
