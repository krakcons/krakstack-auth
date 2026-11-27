import { expect, test } from "@playwright/test";
import { Schema } from "effect";
import { UpdateMemberRolePayload } from "../packages/sdk/src/auth/schema";

test("saves a member's role changes together and shows rejected saves in the editor", async ({
  page,
}) => {
  const date = "2026-01-01T00:00:00.000Z";
  const user = {
    id: "role-editor",
    name: "Role Editor",
    email: "editor@example.test",
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
    id: "role-test-organization",
    slug: "role-test",
    name: "Role Test",
    createdAt: date,
  };
  const membership = {
    id: "role-test-membership",
    organizationId: organization.id,
    userId: user.id,
    createdAt: date,
  };
  let role = "admin,support";
  let rejectSave = true;
  const updates: Array<typeof UpdateMemberRolePayload.Type> = [];
  const rejectionMessage = "You are not allowed to edit this member";

  await page.route("**/api/auth/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const members = [{ ...membership, role, user }];
    if (path.endsWith("/get-session")) {
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
          },
        },
      });
    }
    if (path.endsWith("/organization/list")) {
      return route.fulfill({ json: [organization] });
    }
    if (path.endsWith("/organization/get-full-organization")) {
      return route.fulfill({
        json: { ...organization, members, invitations: [] },
      });
    }
    if (path.endsWith("/organization/list-members")) {
      return route.fulfill({ json: { members, total: members.length } });
    }
    if (path.endsWith("/organization/list-invitations")) {
      return route.fulfill({ json: [] });
    }
    if (path.endsWith("/organization/update-member-role")) {
      const payload = Schema.decodeUnknownSync(UpdateMemberRolePayload)(
        route.request().postDataJSON(),
      );
      updates.push(payload);
      if (rejectSave) {
        return route.fulfill({
          status: 403,
          json: { message: rejectionMessage },
        });
      }
      role = [payload.role].flat().join(",");
      return route.fulfill({ json: { ...membership, role } });
    }
    return route.fallback();
  });

  await page.goto("/e2e/fixtures/sso-settings.html");
  await page.getByRole("button", { name: /Role Test/ }).click();
  await page.getByRole("menuitem", { name: "Members", exact: true }).click();
  const members = page.getByRole("dialog", { name: "Members", exact: true });
  const row = members.getByRole("row").filter({ hasText: user.email });
  const rolesCell = row.getByRole("cell").filter({ hasText: /Admin|Support/ });
  const editor = page.getByRole("dialog", { name: "Edit roles" });
  const save = editor.getByRole("button", { name: "Save roles" });
  const rolePicker = editor.getByRole("combobox", { name: "Role" });
  const toggleRole = async (name: string) => {
    const option = page.getByRole("option", { name, exact: true });
    if (!(await option.isVisible())) await rolePicker.click();
    await option.click();
  };
  const openEditor = async () => {
    await row.getByRole("button", { name: "Actions", exact: true }).click();
    await page.getByRole("menuitem", { name: "Edit roles" }).click();
  };

  await openEditor();
  await expect(editor).toBeVisible();
  await expect(page.getByText(user.email, { exact: true })).toHaveCount(0);
  await expect(save).toBeDisabled();
  await toggleRole("Admin");
  await toggleRole("Support");
  await page.keyboard.press("Escape");
  await save.click();
  await expect(editor.getByRole("alert")).toBeVisible();
  expect(updates).toHaveLength(0);
  await toggleRole("Member");
  await page.keyboard.press("Escape");
  expect(updates).toHaveLength(0);

  await save.click();
  await expect(editor.getByRole("alert")).toHaveText(rejectionMessage);
  await expect(rolePicker.getByText("Member", { exact: true })).toBeVisible();
  expect(updates).toEqual([
    {
      organizationId: organization.id,
      memberId: membership.id,
      role: ["member"],
    },
  ]);
  await editor.getByRole("button", { name: "Back" }).click();
  await expect(rolesCell).toHaveText("Admin, Support");
  expect(updates).toHaveLength(1);

  rejectSave = false;
  await openEditor();
  await expect(editor.getByRole("alert")).toHaveCount(0);
  await toggleRole("Admin");
  await page.keyboard.press("Escape");
  await save.click();
  await expect(editor).toBeHidden();
  await expect(rolesCell).toHaveText("Support");
  expect(updates).toHaveLength(2);
  expect(updates[1]?.role).toEqual(["support"]);
  await row.getByRole("button", { name: "Actions", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "Leave organization" }),
  ).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Edit roles" })).toHaveCount(0);
});
