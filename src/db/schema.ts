import { defineRelations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  lastLoginMethod: text("last_login_method"),
  isAnonymous: boolean("is_anonymous").default(false),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
    impersonatedByOrganizationId: text("impersonated_by_organization_id"),
    activeOrganizationId: text("active_organization_id"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at"),
});

export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
  },
  (table) => [
    index("twoFactor_secret_idx").on(table.secret),
    index("twoFactor_userId_idx").on(table.userId),
  ],
);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at").notNull(),
    metadata: text("metadata"),
    userId: text("user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    uniqueIndex("organization_slug_uidx").on(table.slug),
    uniqueIndex("organization_userId_uidx").on(table.userId),
  ],
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ],
);

export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    configId: text("config_id").default("default").notNull(),
    name: text("name"),
    start: text("start"),
    referenceId: text("reference_id").notNull(),
    prefix: text("prefix"),
    key: text("key").notNull(),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at"),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86400000),
    rateLimitMax: integer("rate_limit_max").default(1000),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_configId_idx").on(table.configId),
    index("apikey_referenceId_idx").on(table.referenceId),
    index("apikey_key_idx").on(table.key),
  ],
);

export const oauthClient = pgTable(
  "oauth_client",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    disabled: boolean("disabled").default(false),
    skipConsent: boolean("skip_consent"),
    enableEndSession: boolean("enable_end_session"),
    subjectType: text("subject_type"),
    scopes: text("scopes").array(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts").array(),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris").array().notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    grantTypes: text("grant_types").array(),
    responseTypes: text("response_types").array(),
    public: boolean("public"),
    type: text("type"),
    requirePKCE: boolean("require_pkce"),
    referenceId: text("reference_id"),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("oauthClient_userId_idx").on(table.userId),
    index("oauthClient_projectId_idx").on(table.projectId),
  ],
);

export const project = pgTable("project", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo"),
  data: jsonb("data").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const projectUser = pgTable(
  "project_user",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("projectUser_projectId_userId_uidx").on(
      table.projectId,
      table.userId,
    ),
    index("projectUser_projectId_idx").on(table.projectId),
    index("projectUser_userId_idx").on(table.userId),
  ],
);

export const projectOrganization = pgTable(
  "project_organization",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("projectOrganization_projectId_organizationId_uidx").on(
      table.projectId,
      table.organizationId,
    ),
    index("projectOrganization_projectId_idx").on(table.projectId),
    index("projectOrganization_organizationId_idx").on(table.organizationId),
  ],
);

export const domains = pgTable(
  "domains",
  {
    id: text("id").primaryKey(),
    hostname: text("hostname").notNull(),
    rootHostname: text("root_hostname").notNull(),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    organizationId: text("organization_id"),
    hostnameId: text("hostname_id").notNull(),
    managed: boolean("managed").default(true).notNull(),
    active: boolean("active").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("domains_hostname_rootHostname_uidx").on(
      table.hostname,
      table.rootHostname,
    ),
    index("domains_projectId_idx").on(table.projectId),
    index("domains_organizationId_idx").on(table.organizationId),
  ],
);

export const oauthRefreshToken = pgTable(
  "oauth_refresh_token",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at"),
    revoked: timestamp("revoked"),
    authTime: timestamp("auth_time"),
    scopes: text("scopes").array().notNull(),
  },
  (table) => [
    index("oauthRefreshToken_clientId_idx").on(table.clientId),
    index("oauthRefreshToken_sessionId_idx").on(table.sessionId),
    index("oauthRefreshToken_userId_idx").on(table.userId),
  ],
);

export const oauthAccessToken = pgTable(
  "oauth_access_token",
  {
    id: text("id").primaryKey(),
    token: text("token").unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at"),
    scopes: text("scopes").array().notNull(),
  },
  (table) => [
    index("oauthAccessToken_clientId_idx").on(table.clientId),
    index("oauthAccessToken_sessionId_idx").on(table.sessionId),
    index("oauthAccessToken_userId_idx").on(table.userId),
    index("oauthAccessToken_refreshId_idx").on(table.refreshId),
  ],
);

export const oauthConsent = pgTable(
  "oauth_consent",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    scopes: text("scopes").array().notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("oauthConsent_clientId_idx").on(table.clientId),
    index("oauthConsent_userId_idx").on(table.userId),
  ],
);

export const schema = {
  user,
  session,
  account,
  verification,
  jwks,
  twoFactor,
  organization,
  member,
  invitation,
  apikey,
  oauthClient,
  project,
  projectUser,
  projectOrganization,
  domains,
  oauthRefreshToken,
  oauthAccessToken,
  oauthConsent,
};

export const relations = defineRelations(
  {
    user,
    session,
    account,
    verification,
    jwks,
    twoFactor,
    organization,
    member,
    invitation,
    apikey,
    oauthClient,
    project,
    projectUser,
    projectOrganization,
    domains,
    oauthRefreshToken,
    oauthAccessToken,
    oauthConsent,
  },
  (r) => ({
    user: {
      sessions: r.many.session({
        from: r.user.id,
        to: r.session.userId,
      }),
      accounts: r.many.account({
        from: r.user.id,
        to: r.account.userId,
      }),
      twoFactors: r.many.twoFactor({
        from: r.user.id,
        to: r.twoFactor.userId,
      }),
      members: r.many.member({
        from: r.user.id,
        to: r.member.userId,
      }),
      invitations: r.many.invitation({
        from: r.user.id,
        to: r.invitation.inviterId,
      }),
      oauthClients: r.many.oauthClient({
        from: r.user.id,
        to: r.oauthClient.userId,
      }),
      oauthRefreshTokens: r.many.oauthRefreshToken({
        from: r.user.id,
        to: r.oauthRefreshToken.userId,
      }),
      oauthAccessTokens: r.many.oauthAccessToken({
        from: r.user.id,
        to: r.oauthAccessToken.userId,
      }),
      oauthConsents: r.many.oauthConsent({
        from: r.user.id,
        to: r.oauthConsent.userId,
      }),
      projectUsers: r.many.projectUser({
        from: r.user.id,
        to: r.projectUser.userId,
      }),
    },
    project: {
      oauthClients: r.many.oauthClient({
        from: r.project.id,
        to: r.oauthClient.projectId,
      }),
      projectUsers: r.many.projectUser({
        from: r.project.id,
        to: r.projectUser.projectId,
      }),
      projectOrganizations: r.many.projectOrganization({
        from: r.project.id,
        to: r.projectOrganization.projectId,
      }),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
      oauthRefreshTokens: r.many.oauthRefreshToken({
        from: r.session.id,
        to: r.oauthRefreshToken.sessionId,
      }),
      oauthAccessTokens: r.many.oauthAccessToken({
        from: r.session.id,
        to: r.oauthAccessToken.sessionId,
      }),
    },
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },
    twoFactor: {
      user: r.one.user({
        from: r.twoFactor.userId,
        to: r.user.id,
      }),
    },
    organization: {
      members: r.many.member({
        from: r.organization.id,
        to: r.member.organizationId,
      }),
      invitations: r.many.invitation({
        from: r.organization.id,
        to: r.invitation.organizationId,
      }),
      projectOrganizations: r.many.projectOrganization({
        from: r.organization.id,
        to: r.projectOrganization.organizationId,
      }),
    },
    member: {
      organization: r.one.organization({
        from: r.member.organizationId,
        to: r.organization.id,
      }),
      user: r.one.user({
        from: r.member.userId,
        to: r.user.id,
      }),
    },
    invitation: {
      organization: r.one.organization({
        from: r.invitation.organizationId,
        to: r.organization.id,
      }),
      user: r.one.user({
        from: r.invitation.inviterId,
        to: r.user.id,
      }),
    },
    oauthClient: {
      user: r.one.user({
        from: r.oauthClient.userId,
        to: r.user.id,
      }),
      project: r.one.project({
        from: r.oauthClient.projectId,
        to: r.project.id,
      }),
      oauthRefreshTokens: r.many.oauthRefreshToken({
        from: r.oauthClient.id,
        to: r.oauthRefreshToken.clientId,
      }),
      oauthAccessTokens: r.many.oauthAccessToken({
        from: r.oauthClient.id,
        to: r.oauthAccessToken.clientId,
      }),
      oauthConsents: r.many.oauthConsent({
        from: r.oauthClient.id,
        to: r.oauthConsent.clientId,
      }),
    },
    oauthRefreshToken: {
      oauthClient: r.one.oauthClient({
        from: r.oauthRefreshToken.clientId,
        to: r.oauthClient.clientId,
      }),
      session: r.one.session({
        from: r.oauthRefreshToken.sessionId,
        to: r.session.id,
      }),
      user: r.one.user({
        from: r.oauthRefreshToken.userId,
        to: r.user.id,
      }),
      oauthAccessTokens: r.many.oauthAccessToken({
        from: r.oauthRefreshToken.id,
        to: r.oauthAccessToken.refreshId,
      }),
    },
    oauthAccessToken: {
      oauthClient: r.one.oauthClient({
        from: r.oauthAccessToken.clientId,
        to: r.oauthClient.clientId,
      }),
      session: r.one.session({
        from: r.oauthAccessToken.sessionId,
        to: r.session.id,
      }),
      user: r.one.user({
        from: r.oauthAccessToken.userId,
        to: r.user.id,
      }),
      oauthRefreshToken: r.one.oauthRefreshToken({
        from: r.oauthAccessToken.refreshId,
        to: r.oauthRefreshToken.id,
      }),
    },
    oauthConsent: {
      oauthClient: r.one.oauthClient({
        from: r.oauthConsent.clientId,
        to: r.oauthClient.clientId,
      }),
      user: r.one.user({
        from: r.oauthConsent.userId,
        to: r.user.id,
      }),
    },
    projectUser: {
      project: r.one.project({
        from: r.projectUser.projectId,
        to: r.project.id,
      }),
      user: r.one.user({
        from: r.projectUser.userId,
        to: r.user.id,
      }),
    },
    projectOrganization: {
      project: r.one.project({
        from: r.projectOrganization.projectId,
        to: r.project.id,
      }),
      organization: r.one.organization({
        from: r.projectOrganization.organizationId,
        to: r.organization.id,
      }),
    },
    domains: {
      project: r.one.project({
        from: r.domains.projectId,
        to: r.project.id,
      }),
    },
  }),
);
