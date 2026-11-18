import { expect, test, type Page } from "@playwright/test";
import { Schema } from "effect";
import {
  SignInSsoPayload,
  SendVerificationOtpPayload,
} from "../packages/sdk/src/auth/schema";

const mockSignIn = async (page: Page, emailMethods = true, google = false) => {
  const requests = {
    otp: 0,
    discoveredEmails: new Array<string>(),
    signIns: 0,
  };
  await page.route("**/api/auth/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    switch (url.pathname) {
      case "/api/auth/project-config":
        return route.fulfill({
          json: {
            projectKey: "sso-sign-in-fixture",
            name: null,
            logoUrl: null,
            authDomain: null,
            rootDomain: null,
            themeCss: null,
            authOptions: {
              emailPassword: emailMethods,
              emailOtp: emailMethods,
              google,
            },
          },
        });
      case "/api/auth/email-otp/send-verification-otp":
        Schema.decodeUnknownSync(SendVerificationOtpPayload)(
          request.postDataJSON(),
        );
        requests.otp++;
        return route.fulfill({ json: { success: true } });
      case "/api/auth/sso/config":
        requests.discoveredEmails.push(url.searchParams.get("email") ?? "");
        return route.fulfill({
          json: url.searchParams.get("email")?.endsWith("@acme.example")
            ? { providerId: "acme-sso" }
            : null,
        });
      case "/api/auth/sign-in/sso": {
        const payload = Schema.decodeUnknownSync(SignInSsoPayload)(
          request.postDataJSON(),
        );
        expect(payload.providerId).toBe("acme-sso");
        requests.signIns++;
        return route.fulfill({
          json: { redirect: true, url: "/sso-complete" },
        });
      }
      default:
        throw new Error(`Unexpected sign-in fixture request: ${url.pathname}`);
    }
  });
  return requests;
};

test("shows SSO with the post-email OTP/password options and uses the latest confirmed email", async ({
  page,
}) => {
  const requests = await mockSignIn(page, true, true);
  await page.context().addCookies([{
    name: "krakstack-auth.last_used_login_method",
    value: "sso",
    url: "http://127.0.0.1:4179",
  }]);
  await page.goto("/e2e/fixtures/sso-sign-in.html");
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  const google = page.getByRole("button", { name: "Continue with Google" });
  const sso = page.getByRole("button", {
    name: /^Single sign-on/,
  });
  const continueButton = page.getByRole("button", {
    name: "Continue",
    exact: true,
  });
  await expect(email).toBeVisible();
  await expect(google).toBeVisible();
  await expect(sso).toHaveCount(0);
  await continueButton.click();
  await expect(email).toBeVisible();
  await expect(sso).toHaveCount(0);
  expect(requests.otp).toBe(0);
  expect(requests.discoveredEmails).toEqual([]);

  await email.fill("first@acme.example");
  await continueButton.click();
  await expect(sso).toBeVisible();
  await expect(sso.getByText("Last used")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /^(Single sign-on|Password|Email code)/,
    }).first(),
  ).toHaveAccessibleName(/^Single sign-on/);
  await expect(page.getByRole("button", { name: "Password", exact: true })).toBeEnabled();
  await expect(google).toHaveCount(0);
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Email code", { exact: true })).toHaveCount(0);
  expect(requests.otp).toBe(0);
  await page
    .getByRole("button", { name: "Email code", exact: true })
    .click();
  await expect(page.getByLabel("Email code", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Password", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(sso).toBeVisible();
  expect(requests.discoveredEmails).toEqual(["first@acme.example"]);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(sso).toHaveCount(0);
  await email.fill("second@acme.example");
  await continueButton.click();
  await expect(sso).toBeVisible();
  await sso.click();
  await expect(page.getByRole("status")).toHaveText("SSO redirect requested");
  expect(requests.discoveredEmails).toEqual(["first@acme.example", "second@acme.example"]);
  expect(requests.signIns).toBe(1);
});

test("highlights the last-used password without opening the password form or hiding other choices", async ({
  page,
}) => {
  const requests = await mockSignIn(page);
  await page.context().addCookies([
    {
      name: "krakstack-auth.last_used_login_method",
      value: "email",
      url: "http://127.0.0.1:4179",
    },
  ]);
  await page.goto("/e2e/fixtures/sso-sign-in.html");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("employee@acme.example");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  const choices = page.getByRole("button", {
    name: /^(Password|Email code|Single sign-on)/,
  });
  await expect(choices).toHaveCount(3);
  await expect(choices.first()).toHaveAccessibleName("Password Last used");
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  expect(requests.otp).toBe(0);

  await choices.first().click();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});

test("keeps Google available alongside company SSO when email methods are disabled", async ({
  page,
}) => {
  await mockSignIn(page, false, true);
  await page.goto("/e2e/fixtures/sso-sign-in.html");
  const google = page.getByRole("button", { name: "Continue with Google" });
  await expect(google).toBeVisible();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("employee@acme.example");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Single sign-on", exact: true }),
  ).toBeEnabled();
  const googleChoice = page.getByRole("button", { name: "Google", exact: true });
  await expect(googleChoice).toBeVisible();
  await expect(googleChoice).toBeEnabled();
});

test("shows the method picker without SSO and only sends a code when selected", async ({ page }) => {
  const requests = await mockSignIn(page);
  await page.context().addCookies([
    {
      name: "krakstack-auth.last_used_login_method",
      value: "email-otp",
      url: "http://127.0.0.1:4179",
    },
  ]);
  await page.goto("/e2e/fixtures/sso-sign-in.html");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("learner@other.example");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const choices = page.getByRole("button", { name: /^(Email code|Password)/ });
  await expect(choices).toHaveCount(2);
  await expect(choices.first()).toHaveAccessibleName("Email code Last used");
  await expect(page.getByRole("button", { name: "Single sign-on", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Email code", { exact: true })).toHaveCount(0);
  expect(requests.otp).toBe(0);
  await choices.first().click();
  await expect(page.getByLabel("Email code", { exact: true })).toBeVisible();
  expect(requests.otp).toBe(1);
});

test("collects an email before SSO when password and email OTP are disabled", async ({
  page,
}) => {
  const requests = await mockSignIn(page, false);
  await page.goto("/e2e/fixtures/sso-sign-in.html");
  const sso = page.getByRole("button", {
    name: "Single sign-on",
    exact: true,
  });
  await expect(sso).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("employee@acme.example");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(sso).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  await sso.click();
  await expect(page.getByRole("status")).toHaveText("SSO redirect requested");
  expect(requests.discoveredEmails).toEqual(["employee@acme.example"]);
  expect(requests.otp).toBe(0);
  expect(requests.signIns).toBe(1);
});
