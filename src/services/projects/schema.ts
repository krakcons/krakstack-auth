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

export const ProjectPublicConfigQuery = Schema.Struct({
  projectId: Schema.optional(Schema.String),
  clientId: Schema.optional(Schema.String),
  host: Schema.optional(Schema.String),
}).annotate({
  identifier: "ProjectPublicConfigQuery",
  title: "Project public config query",
  description:
    "Optional project ID, auth host, and OAuth client ID used to resolve public project branding.",
  examples: [
    {
      projectId: "project-id",
      host: "auth.example.com",
      clientId: "oauth-client-id",
    },
  ],
});

export const ProjectAuthOptions = Schema.Struct({
  emailPassword: Schema.Boolean,
  google: Schema.Boolean,
  signUp: Schema.Boolean,
  signUpName: Schema.Boolean,
}).annotate({
  identifier: "ProjectAuthOptions",
  title: "Project authentication options",
  description: "Resolved authentication methods visible for auth pages.",
  examples: [
    { emailPassword: true, google: true, signUp: true, signUpName: true },
  ],
});

export const ProjectPublicConfig = Schema.Struct({
  projectKey: Schema.String,
  name: Schema.NullOr(Schema.String),
  logoUrl: Schema.NullOr(Schema.String),
  domains: Schema.Array(Schema.String),
  themeCss: Schema.NullOr(Schema.String),
  authOptions: ProjectAuthOptions,
}).annotate({
  identifier: "ProjectPublicConfig",
  title: "Project public config",
  description:
    "Public white-label configuration used by auth pages for a project.",
  examples: [
    {
      projectKey: "auth.example.com",
      name: "Example project",
      logoUrl: "https://example.com/logo.svg",
      domains: ["auth.example.com"],
      themeCss:
        '[data-project-theme="auth.example.com"] { --primary: oklch(0.5 0.1 240); }',
      authOptions: {
        emailPassword: true,
        google: true,
        signUp: false,
        signUpName: true,
      },
    },
  ],
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
export type ProjectPublicConfig = typeof ProjectPublicConfig.Type;
export type ProjectPublicConfigQuery = typeof ProjectPublicConfigQuery.Type;
export type CreateProjectPayload = typeof CreateProjectPayload.Type;
export type UpdateProjectPayload = typeof UpdateProjectPayload.Type;
