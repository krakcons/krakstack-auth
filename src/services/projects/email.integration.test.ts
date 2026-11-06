import * as BunHttpPlatform from "@effect/platform-bun/BunHttpPlatform";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { Etag, HttpRouter } from "effect/http";
import { HttpApi, HttpApiBuilder } from "effect/http-api";
import { SqlClient } from "effect/sql";
import { S3Service, S3ServiceConfig } from "@krak-stack/registry/service-s3";
import { AdminApi } from "@/api";
import { createAuth } from "@/services/auth/config";
import { adminAuthMiddlewareLayer } from "@/services/auth/middleware.server";
import {
  AuthEmailPreview,
  AuthEmailPreviewPayload,
  AuthEmailSettings,
} from "@/services/auth-emails/schema";
import { sqlTestLayer } from "@/services/database";
import { Projects } from ".";
import { adminProjectsApiHandler } from "./api.builder";
import { ProjectDataJson, UpdateProjectPayload } from "./schema";

const SendOtp = Schema.Struct({
  email: Schema.String,
  type: Schema.Literal("sign-in"),
}).annotate({ identifier: "EmailTestSendOtp" });
const VerificationValue = Schema.Struct({ value: Schema.String }).annotate({
  identifier: "EmailTestVerificationValue",
});

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "project email HTTP integration",
  () => {
    it.effect(
      "keeps customized OTPs usable and protects preview, save, and sample delivery",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const projects = yield* Projects;
          const id = crypto.randomUUID();
          const legacyProjectId = `${id}-legacy`;
          const email = `${id}@example.test`;
          const base = new URL(
            process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
          ).origin;
          const settings = {
            appearance: {
              logoPlacement: "header",
              showProjectName: false,
              showFooting: false,
              alignment: "right",
              logoWidth: 120,
              logoAlignment: "right",
              logoSpacingTop: 16,
              logoSpacingBottom: 24,
              foreground: "#112233",
              mutedForeground: "#445566",
              primaryForeground: "#FFFFFF",
            },
            typography: {
              font: "serif",
              heading: {
                alignment: "left",
                color: "#006F69",
                bold: false,
                italic: true,
              },
              body: { color: "#334455" },
              code: { font: "mono", size: 24, color: "#223344", bold: true },
              button: { alignment: "center", color: "#FFFFFF" },
              help: { color: "#556677" },
              projectName: { color: "#667788" },
            },
            layout: {
              header: {
                blocks: [
                  {
                    id: "greeting",
                    type: "text",
                    text: { en: "Header greeting", fr: "Salutation" },
                    style: {
                      color: "#778899",
                      bold: true,
                      underline: true,
                      lineHeight: 1,
                    },
                    spacingTop: 0,
                    spacingBottom: 8,
                  },
                ],
              },
              footer: {
                blocks: [
                  {
                    id: "support",
                    type: "link",
                    translations: {
                      en: { label: "Help", url: "https://example.com/help" },
                      fr: { label: "Aide", url: "mailto:aide@example.com" },
                    },
                    alignment: "center",
                    spacingTop: 4,
                    spacingBottom: 0,
                    style: {
                      color: "#8899AA",
                      underline: false,
                      strikethrough: true,
                      lineHeight: 1.25,
                    },
                  },
                ],
              },
            },
            templates: {
              "sign-in": {
                en: { title: "Custom sign-in", body: "Enter your code" },
              },
            },
          } satisfies AuthEmailSettings;
          const auth = createAuth({
            allowedHosts: [new URL(base).host],
            auditRun: async () => {},
          });
          const config = Layer.succeed(
            ConfigProvider.ConfigProvider,
            ConfigProvider.orElse(
              ConfigProvider.fromUnknown({
                VITE_KRAKSTACK_AUTH_ORGANIZATION_ID: id,
              }),
              yield* ConfigProvider.ConfigProvider,
            ),
          );
          const unusedUploads = Layer.effect(S3Service, S3Service.make).pipe(
            Layer.provide(
              Layer.succeed(S3ServiceConfig, {
                options: {
                  bucket: "unused",
                  endpoint: "https://example.invalid",
                  accessKeyId: "unused",
                  secretAccessKey: "unused",
                },
              }),
            ),
          );
          const web = HttpRouter.toWebHandler(
            HttpApiBuilder.layer(
              HttpApi.make("AdminApi").add(AdminApi.groups.projects),
            ).pipe(
              Layer.provide(adminProjectsApiHandler),
              Layer.provide(adminAuthMiddlewareLayer),
              HttpRouter.provideRequest(
                Layer.mergeAll(
                  Layer.succeed(Projects, projects),
                  Layer.succeed(SqlClient.SqlClient, sql),
                  config,
                  unusedUploads,
                ),
              ),
              Layer.provide(BunHttpPlatform.layer),
              Layer.provide(Etag.layer),
              Layer.provide(BunServices.layer),
            ),
          );
          yield* Effect.addFinalizer(() => Effect.promise(() => web.dispose()));
          yield* Effect.addFinalizer(() =>
            Effect.gen(function* () {
              yield* sql`DELETE FROM verification WHERE identifier LIKE ${`%${email}%`}`;
              yield* sql`DELETE FROM organization WHERE user_id = ${id}`;
              yield* sql`DELETE FROM "user" WHERE id = ${id}`;
              yield* sql`DELETE FROM project WHERE id IN (${id}, ${legacyProjectId})`;
            }).pipe(Effect.orDie),
          );
          const projectData = yield* Schema.encodeEffect(ProjectDataJson)({
            email: settings,
          });
          yield* sql`INSERT INTO project (id, name, data) VALUES (${id}, 'Email project', ${projectData}::jsonb)`;
          yield* sql`INSERT INTO project (id, name, data) VALUES (${legacyProjectId}, 'Existing project', '{"branding":{"themeCss":":root { --primary: #123456; }"}}'::jsonb)`;
          yield* sql`INSERT INTO "user" (id, name, email, email_verified, role) VALUES (${id}, 'Email editor', ${email}, true, 'user')`;
          const otpBody = yield* Schema.encodeEffect(
            Schema.fromJsonString(SendOtp),
          )({ email, type: "sign-in" });
          const sent = yield* Effect.promise(() =>
            auth.handler(
              new Request(`${base}/api/auth/email-otp/send-verification-otp`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  cookie: `krakstack-auth.project_context=${id}`,
                },
                body: otpBody,
              }),
            ),
          );
          expect(sent.status).toBe(200);
          const retrieved = yield* Effect.promise(() =>
            auth.api.getVerificationOTP({ query: { email, type: "sign-in" } }),
          );
          const otp = retrieved.otp;
          if (!otp) return yield* Effect.die("OTP was not persisted");
          const stored =
            yield* sql`SELECT value FROM verification WHERE identifier = ${`sign-in-otp-${email}`}`.pipe(
              Effect.flatMap(
                Schema.decodeUnknownEffect(Schema.Array(VerificationValue)),
              ),
            );
          expect(stored).toHaveLength(1);
          expect(stored[0]?.value).not.toBe(`${otp}:0`);
          const signedIn = yield* Effect.promise(() =>
            auth.api.signInEmailOTP({
              body: { email, otp },
              returnHeaders: true,
            }),
          );
          expect(signedIn.response.user.id).toBe(id);
          yield* Effect.promise(() =>
            expect(
              auth.api.signInEmailOTP({ body: { email, otp } }),
            ).rejects.toThrow(),
          );
          const cookie = signedIn.headers
            .getSetCookie()
            .filter((value) => value.split("=")[0]?.endsWith("session_token"))
            .map((value) => value.split(";")[0])
            .join("; ");
          const payload = {
            kind: "sign-in",
            locale: "en",
            settings,
          } satisfies AuthEmailPreviewPayload;
          const body = yield* Schema.encodeEffect(
            Schema.fromJsonString(AuthEmailPreviewPayload),
          )(payload);
          const request = (
            suffix: string,
            authenticated = true,
            method: "POST" | "PATCH" = "POST",
            content = body,
            projectId: string = id,
          ) =>
            Effect.promise(() => {
              const headers = new Headers({
                "content-type": "application/json",
              });
              if (authenticated) headers.set("cookie", cookie);
              return web.handler(
                new Request(
                  `${base}/api/auth/admin/projects/${projectId}/email${suffix}`,
                  { method, headers, body: content },
                ),
              );
            });
          for (const suffix of ["/preview", "/test", ""]) {
            const method = suffix ? "POST" : "PATCH";
            const content = suffix
              ? body
              : yield* Schema.encodeEffect(
                  Schema.fromJsonString(AuthEmailSettings),
                )(settings);
            expect(
              (yield* request(suffix, false, method, content)).status,
            ).toBe(401);
            expect((yield* request(suffix, true, method, content)).status).toBe(
              403,
            );
          }
          yield* sql`UPDATE "user" SET role = 'admin' WHERE id = ${id}`;
          yield* sql`UPDATE session SET impersonated_by_organization_id = ${id} WHERE user_id = ${id}`;
          for (const suffix of ["/preview", "/test", ""]) {
            expect(
              (yield* request(
                suffix,
                true,
                suffix ? "POST" : "PATCH",
                suffix ? body : "{}",
              )).status,
            ).toBe(403);
          }
          yield* sql`UPDATE session SET impersonated_by_organization_id = NULL WHERE user_id = ${id}`;
          const invalidSettings = [
            '{"appearance":{"showFooting":"false"}}',
            '{"layout":{"footer":{"blocks":[{"id":"unsafe-leading","type":"text","text":{"en":"Hello","fr":"Bonjour"},"style":{"lineHeight":0}}]}}}',
            '{"layout":{"footer":{"blocks":[{"id":"unsafe-spacing","type":"text","text":{"en":"Hello","fr":"Bonjour"},"spacingTop":-1}]}}}',
            '{"typography":{"heading":{"bold":"bold"}}}',
            '{"layout":{"header":{"blocks":[{"id":"unsafe-format","type":"text","text":{"en":"Hello","fr":"Bonjour"},"style":{"italic":"italic"}}]}}}',
            '{"typography":{"heading":{"color":"#123456;color:red"}}}',
            '{"layout":{"footer":{"blocks":[{"id":"unsafe","type":"link","translations":{"en":{"label":"Help","url":"javascript:alert(1)"},"fr":{"label":"Aide","url":"https://example.com"}}}]}}}',
          ];
          for (const invalid of invalidSettings) {
            for (const suffix of ["/preview", "/test", ""]) {
              const response = yield* request(
                suffix,
                true,
                suffix ? "POST" : "PATCH",
                suffix
                  ? `{"kind":"sign-in","locale":"en","settings":${invalid}}`
                  : invalid,
              );
              expect(response.status).toBe(400);
            }
          }
          expect((yield* projects.get({ id }))?.data.email).toEqual(settings);
          const incompleteSettings = {
            layout: {
              header: {
                blocks: [
                  {
                    id: "draft",
                    type: "text",
                    text: { en: "Draft header", fr: "" },
                  },
                ],
              },
            },
          } satisfies AuthEmailSettings;
          const incompleteBody = yield* Schema.encodeEffect(
            Schema.fromJsonString(AuthEmailPreviewPayload),
          )({ kind: "sign-in", locale: "en", settings: incompleteSettings });
          expect(
            (yield* request("/preview", true, "POST", incompleteBody)).status,
          ).toBe(200);
          expect(
            (yield* request("/test", true, "POST", incompleteBody)).status,
          ).toBe(400);
          const incompleteSettingsBody = yield* Schema.encodeEffect(
            Schema.fromJsonString(AuthEmailPreviewPayload.fields.settings),
          )(incompleteSettings);
          expect(
            (yield* request("", true, "PATCH", incompleteSettingsBody)).status,
          ).toBe(400);
          for (const suffix of ["/preview", "/test", ""]) {
            expect(
              (yield* request(
                suffix,
                true,
                suffix ? "POST" : "PATCH",
                suffix ? body : "{}",
                `${id}-missing`,
              )).status,
            ).toBe(404);
            const invalid = suffix
              ? '{"kind":"sign-in","locale":"en","settings":{"appearance":{"background":"not-a-color"}}}'
              : '{"appearance":{"logoWidth":0}}';
            expect(
              (yield* request(suffix, true, suffix ? "POST" : "PATCH", invalid))
                .status,
            ).toBe(400);
          }
          const legacyBody = yield* Schema.encodeEffect(
            Schema.fromJsonString(AuthEmailPreviewPayload),
          )({ kind: "sign-in", locale: "fr", settings: {} });
          const legacyResponse = yield* request(
            "/preview",
            true,
            "POST",
            legacyBody,
            legacyProjectId,
          );
          expect(legacyResponse.status).toBe(200);
          const legacyPreview = yield* Schema.decodeUnknownEffect(
            AuthEmailPreview,
          )(yield* Effect.promise(() => legacyResponse.json()));
          expect(legacyPreview.text).toContain("000000");
          expect(legacyPreview.text).toContain("Existing project");
          expect(legacyPreview.html).not.toContain("Custom sign-in");
          expect((yield* projects.get({ id: legacyProjectId }))?.data).toEqual({
            branding: { themeCss: ":root { --primary: #123456; }" },
          });
          const previewResponse = yield* request("/preview");
          expect(previewResponse.status).toBe(200);
          const preview = yield* Schema.decodeUnknownEffect(AuthEmailPreview)(
            yield* Effect.promise(() => previewResponse.json()),
          );
          expect(preview.text).toContain("000000");
          expect(preview.text).toContain("Custom sign-in");
          expect(preview.html).toContain("Custom sign-in");
          expect(preview.html).toMatch(
            /<h1(?=[^>]*text-align:left)(?=[^>]*color:#006F69)[^>]*>/,
          );
          expect(preview.html).toMatch(
            /<p[^>]*color:#778899[^>]*>Header greeting<\/p>/,
          );
          expect(preview.html).toMatch(/<a[^>]*color:#8899AA[^>]*>Help<\/a>/);
          expect(preview.text).toContain("Header greeting");
          expect(preview.text).toContain("Help: https://example.com/help");
          expect(preview.text).not.toContain("Email project");
          // Preview must use the current saved logo, including replacement and removal.
          for (const logo of [
            `logos/projects/${id}-first.svg`,
            `logos/projects/${id}-second.svg`,
            null,
          ]) {
            const updateBody = yield* Schema.encodeEffect(
              Schema.fromJsonString(UpdateProjectPayload),
            )({ logo, data: {} });
            const updated = yield* Effect.promise(() =>
              web.handler(
                new Request(`${base}/api/auth/admin/projects/${id}`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json", cookie },
                  body: updateBody,
                }),
              ),
            );
            expect(updated.status).toBe(200);
            const refreshed = yield* request("/preview");
            expect(refreshed.status).toBe(200);
            const email = yield* Schema.decodeUnknownEffect(AuthEmailPreview)(
              yield* Effect.promise(() => refreshed.json()),
            );
            if (logo) {
              expect(email.html).toContain(
                `src="${base}/api/auth/assets/${logo}"`,
              );
            } else {
              expect(email.html).not.toContain("/api/auth/assets/logos/");
            }
            expect((yield* projects.get({ id }))?.data.email).toEqual(settings);
          }
          yield* sql`UPDATE "user" SET email_verified = false WHERE id = ${id}`;
          expect((yield* request("/test")).status).toBe(403);
          yield* sql`UPDATE "user" SET email_verified = true WHERE id = ${id}`;
          expect((yield* request("/test")).status).toBe(200);
          expect((yield* request("/test")).status).toBe(200);
          // Draft previews and test delivery must never publish their settings.
          const draftBody = yield* Schema.encodeEffect(
            Schema.fromJsonString(AuthEmailPreviewPayload),
          )({
            ...payload,
            settings: { typography: { heading: { color: "#AABBCC" } } },
          });
          expect(
            (yield* request("/preview", true, "POST", draftBody)).status,
          ).toBe(200);
          expect(
            (yield* request("/test", true, "POST", draftBody)).status,
          ).toBe(200);
          expect((yield* projects.get({ id }))?.data.email).toEqual(settings);
          const settingsBody = yield* Schema.encodeEffect(
            Schema.fromJsonString(AuthEmailSettings),
          )(settings);
          expect((yield* request("", true, "PATCH", settingsBody)).status).toBe(
            200,
          );
          expect((yield* projects.get({ id }))?.data.email).toEqual(settings);
          expect((yield* request("", true, "PATCH", "{}")).status).toBe(200);
          expect((yield* projects.get({ id }))?.data.email).toEqual({});
          const remaining =
            yield* sql`SELECT value FROM verification WHERE identifier LIKE ${`%${email}%`}`;
          expect(remaining).toHaveLength(0);
        }).pipe(
          Effect.scoped,
          Effect.provide(
            Projects.testLayer.pipe(Layer.provideMerge(sqlTestLayer)),
          ),
        ),
    );
  },
);
