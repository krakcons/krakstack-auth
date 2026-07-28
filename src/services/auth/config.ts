import { betterAuth } from "better-auth";
import type { GenericEndpointContext } from "@better-auth/core";
import { drizzleAdapter } from "better-auth-drizzle-adapter";
import {
  admin,
  anonymous,
  emailOTP,
  jwt,
  lastLoginMethod,
  openAPI,
  organization,
  twoFactor,
} from "better-auth/plugins";
import {
  adminAc,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";
import { oauthProvider } from "@better-auth/oauth-provider";
import { apiKey } from "@better-auth/api-key";
import { APIError } from "@better-auth/core/error";
import { Effect } from "effect";
import { organizationRoles } from "@krak-stack/auth/roles";

import { db } from "../../services/database";
import { schema } from "../../db/schema";
import {
  allowedHostsForRequest,
  cookieDomainFromRequest,
  hostFromRequest,
  parseCsv,
  trustedOriginsForRequest,
} from "@/services/domains";
import {
  sendResetPasswordEmail,
  sendEmailVerificationOtpEmail,
  sendTwoFactorOtpEmail,
} from "@/services/auth/email.server";
import { organizationImpersonation } from "@/services/auth/plugins/organization-impersonation";
import { mergeOrganizationMetadata } from "@/services/auth/organization-metadata";
import { DB } from "@/services/database";
import { connectProjectSession } from "@/services/projects/connections";

const isDev = process.env.NODE_ENV === "development";

const validAudiences = parseCsv(process.env.BETTER_AUTH_VALID_AUDIENCES);
const apiKeyRateLimit = {
  enabled: true,
  timeWindow: 1000 * 60 * 60 * 24,
  maxRequests: 1000,
};
const organizationAuthRoles = Object.fromEntries(
  organizationRoles.map((role) => [
    role,
    role === "owner" ? ownerAc : role === "admin" ? adminAc : memberAc,
  ]),
);

const organizationParentId = (value: object) => {
  const parentId = Reflect.get(value, "parentId");
  return typeof parentId === "string" && parentId ? parentId : null;
};

const validateOrganizationParent = ({
  organizationId,
  parentId,
  userId,
}: {
  organizationId?: string;
  parentId: string | null;
  userId: string;
}) =>
  Effect.gen(function* () {
    if (!parentId) return;
    if (parentId === organizationId) {
      return yield* Effect.fail(
        new APIError("BAD_REQUEST", {
          message: "An organization cannot be its own parent",
        }),
      );
    }

    const database = yield* DB;
    const parent = yield* database.query.organization.findFirst({
      where: { id: parentId },
      columns: { id: true, parentId: true },
    });

    if (!parent || parent.parentId) {
      return yield* Effect.fail(
        new APIError("BAD_REQUEST", {
          message: "Parent organization must be a root organization",
        }),
      );
    }

    const [actor, parentMember] = yield* Effect.all([
      database.query.user.findFirst({
        where: { id: userId },
        columns: { role: true },
      }),
      database.query.member.findFirst({
        where: { organizationId: parentId, userId },
        columns: { role: true },
      }),
    ]);
    const isPlatformAdmin =
      actor?.role?.split(",").some((role) => role.trim() === "admin") ?? false;
    const canManageParent =
      parentMember?.role
        .split(",")
        .some((role) => role === "owner" || role === "admin") ?? false;

    if (!isPlatformAdmin && !canManageParent) {
      return yield* Effect.fail(
        new APIError("FORBIDDEN", {
          message: "Parent organization admin access is required",
        }),
      );
    }
  });

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const betterAuthUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const projectContextCookie = "krakstack-auth.project_context";

const organizationSlugPart = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type PersonalOrganizationUser = {
  email: string;
  id: string;
  name: string;
};

const personalOrganizationName = (user: PersonalOrganizationUser) =>
  user.name.trim() || user.email.split("@")[0]?.trim() || user.id;

const personalOrganizationSlugPart = (user: PersonalOrganizationUser) =>
  organizationSlugPart(personalOrganizationName(user)) || "user";

const cookieValue = (headers: Headers | undefined, name: string) => {
  const cookie = headers?.get("cookie");
  if (!cookie) return null;

  return (
    cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
};

const decodeCookieValue = (value: string | null) => {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

const projectIdFromContext = (context: GenericEndpointContext | null) =>
  decodeCookieValue(cookieValue(context?.headers, projectContextCookie));

const connectSessionProject = async (
  session: {
    userId: string;
    activeOrganizationId?: unknown;
  } | null,
  context: GenericEndpointContext | null,
) => {
  const projectId = projectIdFromContext(context);
  if (!projectId || !session?.userId) return;
  const activeOrganizationId =
    typeof session.activeOrganizationId === "string"
      ? session.activeOrganizationId
      : null;

  try {
    await Effect.runPromise(
      connectProjectSession({
        projectId,
        userId: session.userId,
        activeOrganizationId,
      }).pipe(Effect.provide(DB.layer)),
    );
  } catch (error) {
    console.error("Failed to connect auth session to project", error);
  }
};

const createAuth = ({
  allowedHosts,
  cookieDomain,
}: {
  allowedHosts: readonly string[];
  cookieDomain?: string | undefined;
}) => {
  let createPersonalOrganization:
    | ((
        user: PersonalOrganizationUser,
        slug: string,
      ) => Promise<{ id: string }>)
    | undefined;
  const provisionPersonalOrganization = Effect.fn(
    "Auth.provisionPersonalOrganization",
  )(function* (user: PersonalOrganizationUser) {
    const database = yield* DB;
    const current = yield* database.query.organization.findFirst({
      where: { userId: user.id },
      columns: { id: true },
    });
    if (current) return current.id;

    const slugPart = personalOrganizationSlugPart(user);
    const preferredSlug = `${slugPart}-org`;
    const existing = yield* database.query.organization.findFirst({
      where: { slug: preferredSlug },
      columns: { id: true },
    });
    const slug = existing
      ? `${slugPart}-${organizationSlugPart(user.id)}-org`
      : preferredSlug;
    const createOrganization = createPersonalOrganization;
    if (!createOrganization) {
      return yield* Effect.die("Auth is not initialized");
    }
    return yield* Effect.tryPromise({
      try: () => createOrganization(user, slug),
      catch: (cause) => cause,
    }).pipe(
      Effect.map((created) => created.id),
      Effect.catch((cause) =>
        Effect.gen(function* () {
          const concurrentlyCreated =
            yield* database.query.organization.findFirst({
              where: { userId: user.id },
              columns: { id: true },
            });
          if (concurrentlyCreated) return concurrentlyCreated.id;
          return yield* Effect.fail(cause);
        }),
      ),
    );
  });

  const auth = betterAuth({
    appName: "Krakstack Auth",
    baseURL: {
      allowedHosts: Array.from(allowedHosts),
      protocol: isDev ? "http" : "https",
      fallback: betterAuthUrl,
    },
    trustedOrigins: (request) => trustedOriginsForRequest(request),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    advanced: {
      cookiePrefix: "krakstack-auth",
      crossSubDomainCookies: {
        enabled: !isDev,
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      },
      defaultCookieAttributes: {
        sameSite: isDev ? "lax" : "none",
        secure: !isDev,
        httpOnly: true,
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }, request) => {
        await sendResetPasswordEmail({ request, to: user.email, url });
      },
    },
    emailVerification: {
      autoSignInAfterVerification: true,
    },
    ...(googleClientId && googleClientSecret
      ? {
          socialProviders: {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          },
        }
      : {}),
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        allowUnlinkingAll: true,
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (user.isAnonymous === true) return;
            await Effect.runPromise(
              provisionPersonalOrganization(user).pipe(
                Effect.provide(DB.layer),
              ),
            );
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            return await Effect.runPromise(
              Effect.gen(function* () {
                const database = yield* DB;
                const sessionUser = yield* database.query.user.findFirst({
                  where: { id: session.userId },
                  columns: {
                    email: true,
                    id: true,
                    isAnonymous: true,
                    name: true,
                  },
                });
                if (!sessionUser || sessionUser.isAnonymous === true) return;

                const organizationId =
                  yield* provisionPersonalOrganization(sessionUser);
                if (session.activeOrganizationId) return;

                return {
                  data: {
                    ...session,
                    activeOrganizationId: organizationId,
                  },
                };
              }).pipe(Effect.provide(DB.layer)),
            );
          },
          after: connectSessionProject,
        },
        update: {
          after: connectSessionProject,
        },
      },
    },
    plugins: [
      openAPI(),
      admin(),
      anonymous(),
      jwt(),
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: true,
        disableSignUp: true,
        storeOTP: "encrypted",
        allowedAttempts: 5,
        sendVerificationOTP: async ({ email, otp, type }, context) => {
          await sendEmailVerificationOtpEmail({
            request: context?.request,
            to: email,
            otp,
            type,
          });
        },
      }),
      lastLoginMethod({
        cookieName: "krakstack-auth.last_used_login_method",
        storeInDatabase: true,
        customResolveMethod: (context) => {
          if (context.path === "/sign-in/email-otp") return "email-otp";
          return null;
        },
      }),
      twoFactor({
        issuer: "Krakstack Auth",
        allowPasswordless: true,
        otpOptions: {
          sendOTP: async ({ user, otp }, context) => {
            await sendTwoFactorOtpEmail({
              request: context?.request,
              to: user.email,
              otp,
            });
          },
          period: 5,
          allowedAttempts: 5,
          storeOTP: "encrypted",
        },
      }),
      organization({
        allowUserToCreateOrganization: true,
        invitationExpiresIn: 14 * 24 * 60 * 60,
        membershipLimit: 100,
        roles: organizationAuthRoles,
        schema: {
          organization: {
            additionalFields: {
              userId: {
                type: "string",
                required: false,
              },
              parentId: {
                type: "string",
                required: false,
              },
            },
          },
        },
        organizationHooks: {
          beforeCreateOrganization: async ({ organization, user }) => {
            const parentId = organizationParentId(organization);
            await Effect.runPromise(
              validateOrganizationParent({ parentId, userId: user.id }).pipe(
                Effect.provide(DB.layer),
              ),
            );
            const slugPart = personalOrganizationSlugPart(user);
            const personalSlugs = [
              `${slugPart}-org`,
              `${slugPart}-${organizationSlugPart(user.id)}-org`,
            ];

            return {
              data: {
                ...organization,
                userId: personalSlugs.includes(organization.slug ?? "")
                  ? user.id
                  : null,
              },
            };
          },
          beforeUpdateOrganization: async ({ organization, member }) => {
            return await Effect.runPromise(
              Effect.gen(function* () {
                yield* validateOrganizationParent({
                  organizationId: member.organizationId,
                  parentId: organizationParentId(organization),
                  userId: member.userId,
                });
                const database = yield* DB;
                const current = yield* database.query.organization.findFirst({
                  where: { id: member.organizationId },
                  columns: { metadata: true, userId: true },
                });

                return {
                  data: {
                    ...organization,
                    ...(organization.metadata
                      ? {
                          metadata: mergeOrganizationMetadata(
                            current?.metadata,
                            organization.metadata,
                          ),
                        }
                      : {}),
                    userId: current?.userId ?? null,
                  },
                };
              }).pipe(Effect.provide(DB.layer)),
            );
          },
          beforeDeleteOrganization: async ({ organization }) => {
            if (!organization.userId) return;

            throw new APIError("FORBIDDEN", {
              message: "Personal organizations cannot be deleted",
            });
          },
        },
      }),
      organizationImpersonation(),
      apiKey([
        {
          configId: "user",
          defaultPrefix: "user_",
          references: "user",
          rateLimit: apiKeyRateLimit,
        },
        {
          configId: "organization",
          defaultPrefix: "org_",
          references: "organization",
          rateLimit: apiKeyRateLimit,
        },
        {
          configId: "service",
          defaultPrefix: "svc_",
          references: "user",
          rateLimit: {
            enabled: true,
            timeWindow: 1000 * 60 * 60 * 24,
            maxRequests: 10000,
          },
        },
      ]),
      oauthProvider({
        loginPage: "/sign-in",
        consentPage: "/consent",
        allowDynamicClientRegistration: false,
        silenceWarnings: {
          oauthAuthServerConfig: true,
        },
        clientReference: ({ session }) => {
          return (
            (session?.activeOrganizationId as string | undefined) ?? undefined
          );
        },
        clientPrivileges: async ({ user }) => {
          const role = (user as { role?: unknown } | undefined)?.role;
          if (typeof role !== "string") return false;

          return role.split(",").some((item) => item.trim() === "admin");
        },
        scopes: ["openid", "profile", "email", "offline_access"],
        ...(validAudiences ? { validAudiences } : {}),
      }),
    ],
  });

  createPersonalOrganization = (user, slug) =>
    auth.api.createOrganization({
      body: {
        name: personalOrganizationName(user),
        slug,
        userId: user.id,
      },
    });

  return auth;
};

const authByRequestScope = new Map<string, ReturnType<typeof createAuth>>();

export const authForRequest = async (request: Request) => {
  const host = hostFromRequest(request);
  const allowedHosts = await allowedHostsForRequest(request);
  const cookieDomain = await cookieDomainFromRequest(request);
  const cacheKey = `${host}|${cookieDomain ?? ""}|${allowedHosts.join(",")}`;

  const cached = authByRequestScope.get(cacheKey);
  if (cached) return cached;

  const next = createAuth({ allowedHosts, cookieDomain });
  authByRequestScope.set(cacheKey, next);
  return next;
};

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth["$Infer"]["Session"];
