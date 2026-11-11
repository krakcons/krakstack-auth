import { expect, test } from "@playwright/test";
import { Schema } from "effect";
import {
  ProjectMcpSettings,
  type ProjectMcp,
} from "../src/services/project-mcp/schema";

test("upgrades saved read-only access, persists it, and recovers after a rejected save", async ({
  page,
}) => {
  let stored: ProjectMcp | null = {
    projectId: "test-project",
    url: "https://learning.example.test/api/mcp",
    enabled: true,
    dynamicClientRegistration: true,
    scopes: ["mcp:read"],
  };
  let rejectNext = false;
  await page.route(
    "**/api/auth/admin/projects/test-project/mcp",
    async (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: stored });
      const payload = Schema.decodeUnknownSync(ProjectMcpSettings)(
        route.request().postDataJSON(),
      );
      if (rejectNext) {
        rejectNext = false;
        return route.fulfill({ status: 400, json: { _tag: "BadRequest" } });
      }
      stored = { projectId: "test-project", ...payload };
      return route.fulfill({ json: stored });
    },
  );
  await page.goto("/e2e/fixtures/mcp-settings.html");
  const endpoint = page.getByRole("textbox", {
    name: "MCP endpoint URL",
    exact: true,
  });
  const enabled = page.getByRole("checkbox", {
    name: "Enable MCP OAuth",
    exact: true,
  });
  const save = page.getByRole("button", {
    name: "Save MCP settings",
    exact: true,
  });
  await endpoint.fill("https://learning.example.test/api/mcp");
  await enabled.check();
  const access = page.getByRole("combobox", { name: "Access", exact: true });
  await expect(access).toContainText("Read only");
  await access.click();
  await page
    .getByRole("option", { name: "Read and write", exact: true })
    .click();
  await save.click();
  await expect
    .poll(() => stored)
    .toEqual({
      projectId: "test-project",
      url: "https://learning.example.test/api/mcp",
      enabled: true,
      dynamicClientRegistration: true,
      scopes: ["mcp:read", "mcp:write"],
    });
  await page.reload();
  await expect(endpoint).toHaveValue("https://learning.example.test/api/mcp");
  await expect(enabled).toBeChecked();
  await expect(access).toContainText("Read and write");
  rejectNext = true;
  await endpoint.fill("https://other.example.test/api/mcp");
  await save.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.reload();
  await expect(endpoint).toHaveValue("https://learning.example.test/api/mcp");
  await enabled.uncheck();
  await save.click();
  await expect.poll(() => stored?.enabled).toBe(false);
  await page.reload();
  await expect(enabled).not.toBeChecked();
});
