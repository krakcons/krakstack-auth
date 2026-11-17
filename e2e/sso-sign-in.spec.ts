import { expect, test, type Page } from "@playwright/test";
import { Schema } from "effect";
import {
  SignInSsoPayload,
  SendVerificationOtpPayload,
} from "../packages/sdk/src/auth/schema";

const mockSignIn = async (page: Page, emailMethods = true) => {
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
              google: false,
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
        return route.fulfill({ json: { providerId: "acme-sso" } });
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
  const requests = await mockSignIn(page);
  await page.goto("/e2e/fixtures/sso-sign-in.html");
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  const sso = page.getByRole("button", {
    name: "Continue with company SSO",
    exact: true,
  });
  const continueButton = page.getByRole("button", {
    name: "Continue",
    exact: true,
  });
  await expect(email).toBeVisible();
  await expect(sso).toHaveCount(0);
  await continueButton.click();
  await expect(email).toBeVisible();
  await expect(sso).toHaveCount(0);
  expect(requests.otp).toBe(0);
  expect(requests.discoveredEmails).toEqual([]);

  await email.fill("first@acme.example");
  await continueButton.click();
  await expect(sso).toBeVisible();
  await expect(page.getByLabel("Email code", { exact: true })).toHaveCount(0);
  expect(requests.otp).toBe(0);
  await page
    .getByRole("button", { name: "Use email code", exact: true })
    .click();
  await expect(page.getByLabel("Email code", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use password", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(sso).toBeVisible();
  expect(requests.discoveredEmails).toEqual([]);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(sso).toHaveCount(0);
  await email.fill("second@acme.example");
  await continueButton.click();
  await expect(sso).toBeVisible();
  await sso.click();
  await expect(page.getByRole("status")).toHaveText("SSO redirect requested");
  expect(requests.discoveredEmails).toEqual(["second@acme.example"]);
  expect(requests.signIns).toBe(1);
});

test("collects an email before SSO when password and email OTP are disabled", async ({
  page,
}) => {
  const requests = await mockSignIn(page, false);
  await page.goto("/e2e/fixtures/sso-sign-in.html");
  const sso = page.getByRole("button", {
    name: "Continue with company SSO",
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
