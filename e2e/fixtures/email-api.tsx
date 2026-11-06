import type { Page } from "@playwright/test";
import { Schema } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AuthEmailPreviewPayload,
  AuthEmailSettings,
} from "../../src/services/auth-emails/schema";
import type { Project } from "../../src/services/projects/schema";

interface EmailApiState {
  stored: AuthEmailSettings | undefined;
  saves: Array<AuthEmailSettings>;
  samples: Array<AuthEmailPreviewPayload>;
  failNextSave: boolean;
  failNextSample: boolean;
  holdSave: Promise<void> | undefined;
}

export const installEmailApi = async (page: Page) => {
  const state: EmailApiState = {
    stored: undefined,
    saves: [],
    samples: [],
    failNextSave: false,
    failNextSample: false,
    holdSave: undefined,
  };
  const project = (): Project => ({
    id: "email-editor-regression",
    name: "Regression project",
    logo: null,
    data: { email: state.stored, authOptions: { emailOtp: true } },
    createdAt: new Date("2026-11-05T00:00:00.000Z"),
    updatedAt: new Date("2026-11-05T00:00:00.000Z"),
  });

  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:4179"
      ? route.fallback()
      : route.abort("blockedbyclient"),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/admin/projects" && request.method() === "GET") {
      return route.fulfill({ json: [project()] });
    }
    const emailPath = `/api/auth/admin/projects/${project().id}/email`;
    if (path === emailPath && request.method() === "PATCH") {
      const settings = Schema.decodeUnknownSync(AuthEmailSettings)(
        request.postDataJSON(),
      );
      state.saves.push(settings);
      await state.holdSave;
      if (state.failNextSave) {
        state.failNextSave = false;
        return route.fulfill({
          status: 500,
          json: { _tag: "InternalServerError" },
        });
      }
      state.stored = settings;
      return route.fulfill({ json: project() });
    }
    if (path === `${emailPath}/test` && request.method() === "POST") {
      const payload = Schema.decodeUnknownSync(AuthEmailPreviewPayload)(
        request.postDataJSON(),
      );
      state.samples.push(payload);
      if (state.failNextSample) {
        state.failNextSample = false;
        return route.fulfill({
          status: 500,
          json: { _tag: "InternalServerError" },
        });
      }
      return route.fulfill({ status: 200 });
    }
    if (path === `${emailPath}/preview` && request.method() === "POST") {
      const payload = Schema.decodeUnknownSync(AuthEmailPreviewPayload)(
        request.postDataJSON(),
      );
      const content =
        payload.settings.templates?.[payload.kind]?.[payload.locale];
      const heading = content?.title ?? `${payload.kind}-${payload.locale}`;
      // Renderer behavior is covered in Vitest; this adapter supplies deterministic
      // preview data while exercising the editor's real HTTP atoms and cache.
      const html = renderToStaticMarkup(
        <html lang={payload.locale}>
          <body
            style={{
              backgroundColor:
                payload.settings.appearance?.background ?? "#ffffff",
            }}
          >
            <h1>{heading}</h1>
            <p>{content?.body ?? "Sample content"}</p>
          </body>
        </html>,
      );
      return route.fulfill({
        json: {
          subject: content?.subject ?? "Sample subject",
          html,
          text: heading,
        },
      });
    }
    return route.abort("blockedbyclient");
  });
  return state;
};
