import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth-drizzle-adapter";
import {
  admin,
  emailOTP,
  jwt,
  openAPI,
  organization,
  twoFactor,
} from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { apiKey } from "@better-auth/api-key";

import { db } from "../../services/database";
import { schema } from "../../db/schema";
import {
  allowedHostsForRequest,
  cookieDomainFromRequest,
  hostFromRequest,
  parseCsv,
} from "@/services/domains";
import {
  sendResetPasswordEmail,
  sendEmailVerificationOtpEmail,
  sendTwoFactorOtpEmail,
} from "@/services/auth/email.server";

const isDev = process.env.NODE_ENV === "development";

const validAudiences = parseCsv(process.env.BETTER_AUTH_VALID_AUDIENCES);
const apiKeyRateLimit = {
  enabled: true,
  timeWindow: 1000 * 60 * 60 * 24,
  maxRequests: 1000,
};

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const betterAuthUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

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
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
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
        organizationLimit: 10,
        membershipLimit: 100,
      }),
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
