import { Schema } from "effect";

export const ProjectData = Schema.Struct({
  domains: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  branding: Schema.optional(
    Schema.Struct({
      themeCss: Schema.optional(Schema.String),
    }),
  ),
  authOptions: Schema.optional(
    Schema.Struct({
      emailPassword: Schema.optional(Schema.Boolean),
      google: Schema.optional(Schema.Boolean),
      signUp: Schema.optional(Schema.Boolean),
      signUpName: Schema.optional(Schema.Boolean),
    }),
  ),
}).annotate({
  identifier: "ProjectData",
  title: "Project data",
  description: "White-label theme, auth domains, and authentication settings.",
  examples: [
    {
      domains: ["auth.example.com"],
      branding: { themeCss: ":root { --primary: oklch(0.5 0.1 240); }" },
      authOptions: {
        emailPassword: true,
        google: true,
        signUp: false,
        signUpName: true,
      },
    },
  ],
});

export const Project = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  logo: Schema.NullOr(Schema.String),
  data: ProjectData,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}).annotate({
  identifier: "Project",
  title: "Project",
  description: "Project-owned branding and auth configuration.",
});

export const ProjectIdParams = Schema.Struct({
  id: Schema.String,
}).annotate({
  identifier: "ProjectIdParams",
  title: "Project ID params",
  description: "Path parameters used to identify a project.",
});

export const CreateProjectPayload = Schema.Struct({
  name: Schema.NonEmptyString,
  slug: Schema.NonEmptyString,
  logo: Schema.optional(Schema.NullOr(Schema.String)),
  data: ProjectData,
}).annotate({
  identifier: "CreateProjectPayload",
  title: "Create project payload",
  description: "Payload used by administrators to create a project.",
});

export const UpdateProjectPayload = Schema.Struct({
  name: Schema.optional(Schema.NonEmptyString),
  slug: Schema.optional(Schema.NonEmptyString),
  logo: Schema.optional(Schema.NullOr(Schema.String)),
  data: ProjectData,
}).annotate({
  identifier: "UpdateProjectPayload",
  title: "Update project payload",
  description: "Payload used by administrators to update project settings.",
});

export const ProjectDataStandard = Schema.toStandardSchemaV1(ProjectData);

export type ProjectData = typeof ProjectData.Type;
export type Project = typeof Project.Type;
export type CreateProjectPayload = typeof CreateProjectPayload.Type;
export type UpdateProjectPayload = typeof UpdateProjectPayload.Type;
