import { betterAuth } from "better-auth";
import type { GenericEndpointContext } from "@better-auth/core";
import { drizzleAdapter } from "better-auth-drizzle-adapter";
import {
  admin,
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

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const betterAuthUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const projectContextCookie = "krakstack-auth.project_context";

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
}) =>
  betterAuth({
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
      session: {
        create: {
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
        membershipLimit: 100,
        roles: organizationAuthRoles,
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
