import { Schema } from "effect";
import { DashboardStatsQuery } from "@krak-stack/auth/admin";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/http-api";

import {
  ImageUploadMultipartPayload,
  UploadedAsset,
} from "@/services/s3/schema";
import { AdminAuthMiddleware } from "@/services/auth/middleware";
import {
  AuthEmailSettings,
  AuthEmailPreviewPayload,
  AuthEmailPreview,
} from "@/services/auth-emails/schema";

import {
  CreateProjectPayload,
  Project,
  ProjectStats,
  ProjectIdParams,
  ProjectPublicConfig,
  ProjectPublicConfigQuery,
  UpdateProjectPayload,
} from "./schema";

export const PublicProjectsApiGroup = HttpApiGroup.make("publicProjects")
  .add(
    HttpApiEndpoint.get("getProjectPublicConfig", "/projects/config", {
      query: ProjectPublicConfigQuery,
      success: ProjectPublicConfig,
      error: [HttpApiError.InternalServerError],
    }).annotateMerge(
      OpenApi.annotations({
        title: "Get project public config",
        summary: "Get host-aware project white-label config",
        description:
          "Returns resolved public branding and authentication options using project domain, OAuth client project, then platform defaults.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Projects",
      description: "Public project white-label endpoints.",
    }),
  );

export const AdminProjectsApiGroup = HttpApiGroup.make("projects")
  .add(
    HttpApiEndpoint.patch("updateProjectEmail", "/admin/projects/:id/email", {
      params: ProjectIdParams,
      payload: AuthEmailSettings,
      success: Project,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.post(
      "previewProjectEmail",
      "/admin/projects/:id/email/preview",
      {
        params: ProjectIdParams,
        payload: AuthEmailPreviewPayload,
        success: AuthEmailPreview,
        error: [
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.NotFound,
          HttpApiError.InternalServerError,
        ],
      },
    ),
  )
  .add(
    HttpApiEndpoint.post("testProjectEmail", "/admin/projects/:id/email/test", {
      params: ProjectIdParams,
      payload: AuthEmailPreviewPayload,
      success: Schema.Void,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.get("projectStats", "/admin/projects/:id/stats", {
      params: ProjectIdParams,
      query: DashboardStatsQuery,
      success: ProjectStats,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.get("listProjects", "/admin/projects", {
      success: Schema.Array(Project),
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        title: "List projects",
        summary: "List projects for administrators",
        description: "Returns projects and their white-label settings.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("createProject", "/admin/projects", {
      payload: CreateProjectPayload,
      success: Project,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.patch("updateProject", "/admin/projects/:id", {
      params: ProjectIdParams,
      payload: UpdateProjectPayload,
      success: Project,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.delete("deleteProject", "/admin/projects/:id", {
      params: ProjectIdParams,
      success: Project,
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.post("uploadProjectLogo", "/admin/projects/logo/upload", {
      payload: ImageUploadMultipartPayload,
      success: UploadedAsset,
      error: [
        HttpApiError.BadRequest,
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.InternalServerError,
      ],
    }),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Projects",
      description: "Administrative project white-label endpoints.",
    }),
  )
  .middleware(AdminAuthMiddleware);
