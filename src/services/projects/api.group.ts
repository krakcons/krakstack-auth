import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

import { PresignedUpload, PresignUploadPayload } from "@/services/s3/schema";

import {
  CreateProjectPayload,
  Project,
  ProjectIdParams,
  UpdateProjectPayload,
} from "./schema";

export const AdminProjectsApiGroup = HttpApiGroup.make("projects")
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
    HttpApiEndpoint.post(
      "presignProjectLogoUpload",
      "/admin/projects/logo/presign",
      {
        payload: PresignUploadPayload,
        success: PresignedUpload,
        error: [
          HttpApiError.BadRequest,
          HttpApiError.Unauthorized,
          HttpApiError.Forbidden,
          HttpApiError.InternalServerError,
        ],
      },
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Projects",
      description: "Administrative project white-label endpoints.",
    }),
  );
