import { expect, test, type Page } from "@playwright/test";
import { Schema } from "effect";
import {
  OrganizationSsoSettings,
  OrganizationSsoEnabled,
  type OrganizationSsoConnection,
} from "../packages/sdk/src/auth/schema";

const mockOrganizationSession = async (
  page: Page,
  role = "owner",
  impersonated = false,
) => {
  const date = "2026-01-01T00:00:00.000Z";
  const user = {
    id: "test-user",
    name: "Test User",
    email: "user@acme.example",
    emailVerified: true,
    locale: "en",
    image: null,
    metadata: null,
    role: "user",
    banned: false,
    createdAt: date,
    updatedAt: date,
  };
  const organization = {
    id: "test-organization",
    name: "Acme",
    slug: "acme",
    createdAt: date,
  };
  await page.route("**/api/auth/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/get-session"))
      return route.fulfill({
        json: {
          user,
          session: {
            id: "test-session",
            token: "test-token",
            userId: user.id,
            createdAt: date,
            updatedAt: date,
            expiresAt: "2040-01-01T00:00:00.000Z",
            activeOrganizationId: organization.id,
            impersonatedBy: impersonated ? "platform-admin" : null,
          },
        },
      });
    if (path.endsWith("/organization/list"))
      return route.fulfill({ json: [organization] });
    if (path.endsWith("/organization/get-full-organization"))
      return route.fulfill({
        json: {
          ...organization,
          invitations: [],
          members: [
            {
              id: "test-membership",
              organizationId: organization.id,
              userId: user.id,
              role,
              createdAt: date,
              user,
            },
          ],
        },
      });
    if (
      path.endsWith("/organization/list-user-invitations") ||
      path.endsWith("/associated-projects")
    )
      return route.fulfill({ json: [] });
    return route.fallback();
  });
};

const openSecurity = async (page: Page) => {
  await page.getByRole("button", { name: /Acme/ }).click();
  await page.getByRole("menuitem", { name: "Security", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Security", exact: true }),
  ).toBeVisible();
};

test("configures an organization connection, verifies ownership, rolls back a rejected enable and removes it", async ({
  page,
}) => {
  let stored: typeof OrganizationSsoConnection.Type | null = null;
  let rejectVerification = true;
  let rejectEnable = true;
  let rejectRemoval = true;
  let settingsReads = 0;
  await mockOrganizationSession(page);
  await page.route("**/api/auth/organization/sso**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET") {
      settingsReads++;
      expect(new URL(request.url()).searchParams.get("organizationId")).toBe(
        "test-organization",
      );
      return route.fulfill({ json: stored });
    }
    if (path.endsWith("/verify")) {
      if (rejectVerification) {
        rejectVerification = false;
        return route.fulfill({
          status: 400,
          json: { code: "DOMAIN_VERIFICATION_FAILED" },
        });
      }
      if (stored)
        stored = {
          ...stored,
          domainVerified: true,
          verificationToken: undefined,
        };
    } else if (path.endsWith("/enabled")) {
      const payload = Schema.decodeUnknownSync(OrganizationSsoEnabled)(
        request.postDataJSON(),
      );
      if (rejectEnable) {
        rejectEnable = false;
        return route.fulfill({
          status: 400,
          json: { code: "ENABLE_REJECTED" },
        });
      }
      if (stored) stored = { ...stored, enabled: payload.enabled };
    } else if (path.endsWith("/delete")) {
      if (rejectRemoval) {
        rejectRemoval = false;
        return route.fulfill({
          status: 400,
          json: { code: "REMOVE_REJECTED" },
        });
      }
      stored = null;
      return route.fulfill({ json: { success: true } });
    } else {
      const payload = Schema.decodeUnknownSync(
        Schema.toCodecJson(OrganizationSsoSettings),
      )(request.postDataJSON());
      expect(payload.clientSecret).toBe(
        stored ? undefined : "entered-test-secret",
      );
      stored = {
        organizationId: payload.organizationId,
        providerId: "test-sso-provider",
        issuer: payload.issuer,
        domain: payload.domain,
        clientId: payload.clientId,
        enabled: Boolean(
          stored?.enabled && stored.clientId === payload.clientId,
        ),
        domainVerified: stored?.domainVerified ?? false,
        verificationName: "_krakstack-sso-test-sso-provider.acme.example",
        verificationToken: stored?.domainVerified
          ? undefined
          : "dns-proof-token",
      };
    }
    return route.fulfill({ json: stored });
  });
  await page.goto("/e2e/fixtures/sso-settings.html");
  await expect(page.getByRole("button", { name: /Acme/ })).toBeVisible();
  expect(settingsReads).toBe(0);
  await openSecurity(page);
  const issuer = page.getByRole("textbox", {
    name: "OIDC issuer URL",
    exact: true,
  });
  const domain = page.getByRole("textbox", {
    name: "Company email domain",
    exact: true,
  });
  const secret = page.getByLabel("Client secret", { exact: true });
  await issuer.fill("https://acme.okta.com/oauth2/default");
  await domain.fill("acme.example");
  await page
    .getByRole("textbox", { name: "Client ID", exact: true })
    .fill("client-id");
  await secret.fill("entered-test-secret");
  await page
    .getByRole("button", { name: "Save connection", exact: true })
    .click();
  await expect(issuer).toBeHidden();
  await expect(secret).toBeHidden();
  await page.getByText("Identity provider", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit credentials", exact: true }),
  ).toHaveCount(0);
  await expect(issuer).toBeDisabled();
  await expect(domain).toBeDisabled();
  await expect(secret).toHaveValue("");
  await page.getByText("Identity provider", { exact: true }).click();
  await expect(secret).toBeHidden();
  await expect(
    page.getByLabel("Callback URL to register with your identity provider"),
  ).toHaveValue(
    "http://127.0.0.1:4179/api/auth/sso/callback/test-sso-provider",
  );
  const enable = page.getByRole("button", { name: "Enable SSO", exact: true });
  await expect(enable).toBeDisabled();
  const verify = page.getByRole("button", {
    name: "Verify DNS record",
    exact: true,
  });
  await verify.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(enable).toBeDisabled();
  await verify.click();
  await expect(enable).toBeEnabled();
  await enable.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(enable).toBeEnabled();
  await enable.click();
  await expect(
    page.getByRole("button", { name: "Disable SSO", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await openSecurity(page);
  await expect(
    page.getByRole("button", { name: "Disable SSO", exact: true }),
  ).toBeEnabled();
  await expect(secret).toBeHidden();
  await page.getByText("Identity provider", { exact: true }).click();
  await expect(secret).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Save connection", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Client ID", exact: true })
    .fill(" client-id ");
  await page
    .getByRole("button", { name: "Save connection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Disable SSO", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("textbox", { name: "Client ID", exact: true })
    .fill(" updated-client-id ");
  await page
    .getByRole("button", { name: "Save connection", exact: true })
    .click();
  await expect(secret).toHaveValue("");
  await expect(enable).toBeEnabled();
  await enable.click();
  await expect(
    page.getByRole("button", { name: "Disable SSO", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Remove connection", exact: true })
    .click();
  const removalDialog = page.getByRole("region", {
    name: "Remove SSO connection?",
    exact: true,
  });
  await expect(removalDialog).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Disable SSO", exact: true }),
  ).toBeHidden();
  await removalDialog
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(removalDialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Remove SSO connection", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove connection", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Remove connection", exact: true })
    .click();
  await removalDialog
    .getByRole("button", { name: "Remove SSO connection", exact: true })
    .click();
  await expect(removalDialog.getByRole("alert")).toBeVisible();
  await removalDialog
    .getByRole("button", { name: "Remove SSO connection", exact: true })
    .click();
  await expect(removalDialog).toBeHidden();
  await expect(issuer).toBeEnabled();
  await expect(issuer).toHaveValue("");
});

for (const scenario of [
  { name: "ordinary members", role: "member", impersonated: false },
  { name: "impersonated owners", role: "owner", impersonated: true },
]) {
  test(`does not expose organization security to ${scenario.name}`, async ({
    page,
  }) => {
    await mockOrganizationSession(page, scenario.role, scenario.impersonated);
    let settingsReads = 0;
    await page.route("**/api/auth/organization/sso**", async (route) => {
      settingsReads++;
      return route.fulfill({ status: 403, json: { code: "FORBIDDEN" } });
    });
    await page.goto("/e2e/fixtures/sso-settings.html");
    await page.getByRole("button", { name: /Acme/ }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Security", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("dialog", { name: "Security", exact: true }),
    ).toHaveCount(0);
    expect(settingsReads).toBe(0);
  });
}
