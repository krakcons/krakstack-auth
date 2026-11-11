import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from "effect/http-api";

import { AdminAuthMiddleware } from "@/services/auth/middleware";
import { ProjectMcp, ProjectMcpParams, ProjectMcpSettings } from "./schema";

export const AdminProjectMcpApiGroup = HttpApiGroup.make("projectMcp")
  .add(
    HttpApiEndpoint.get("getProjectMcp", "/admin/projects/:projectId/mcp", {
      params: ProjectMcpParams,
      success: Schema.NullOr(ProjectMcp),
      error: [HttpApiError.InternalServerError],
    }),
  )
  .add(
    HttpApiEndpoint.put(
      "configureProjectMcp",
      "/admin/projects/:projectId/mcp",
      {
        params: ProjectMcpParams,
        payload: ProjectMcpSettings,
        success: ProjectMcp,
        error: [
          HttpApiError.BadRequest,
          HttpApiError.NotFound,
          HttpApiError.InternalServerError,
        ],
      },
    ),
  )
  .middleware(AdminAuthMiddleware);
