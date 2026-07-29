import type { BetterAuthPlugin } from "better-auth";
import type { GenericEndpointContext } from "@better-auth/core";
import { getSessionFromCtx } from "better-auth/api";
import { createAuthEndpoint } from "@better-auth/core/api";
import type { BetterAuthPluginDBSchema } from "@better-auth/core/db";
import { APIError } from "@better-auth/core/error";
import { defaultKeyHasher } from "@better-auth/api-key";
import { deleteSessionCookie, setSessionCookie } from "better-auth/cookies";
import { and, eq } from "drizzle-orm";
import * as z from "zod";
import { globalAdminRoles, hasAnyRole } from "@krak-stack/auth/roles";

import { apikey, organization, user as authUser } from "@/db/schema";
import { db } from "@/services/database";

const authError = (code: string, message: string) => ({ code, message });

const schema = {
  session: {
    fields: {
      impersonatedByOrganizationId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;

const bodySchema = z.object({
  organizationId: z.string().min(1),
  actorUserId: z.string().min(1),
  targetUserId: z.string().min(1),
  expiresInSeconds: z
    .number()
    .int()
    .positive()
    .max(60 * 60 * 24)
    .optional(),
});

const bearerToken = (value: string | null) => {
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice("Bearer ".length).trim() || null;
};

const serviceApiKeyFromHeaders = (headers: Headers | undefined) =>
  bearerToken(headers?.get("authorization") ?? null) ??
  headers?.get("x-api-key") ??
  null;

const verifyServiceApiKey = async (headers: Headers | undefined) => {
  const key = serviceApiKeyFromHeaders(headers);
  if (!key) return false;

  const hashedKey = await defaultKeyHasher(key);
  const [record] = await db
    .select({
      id: apikey.id,
      enabled: apikey.enabled,
      expiresAt: apikey.expiresAt,
    })
    .from(apikey)
    .where(and(eq(apikey.key, hashedKey), eq(apikey.configId, "service")))
    .limit(1);

  if (!record) {
    throw APIError.from(
      "UNAUTHORIZED",
      authError("INVALID_API_KEY", "Invalid API key"),
    );
  }
  if (record.enabled === false) {
    throw APIError.from(
      "UNAUTHORIZED",
      authError("API_KEY_DISABLED", "API key disabled"),
    );
  }
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    throw APIError.from(
      "UNAUTHORIZED",
      authError("API_KEY_EXPIRED", "API key expired"),
    );
  }

  return true;
};

const requireServiceApiKeyOrGlobalAdmin = async (
  ctx: GenericEndpointContext,
  actorSession: NonNullable<Awaited<ReturnType<typeof getSessionFromCtx>>>,
) => {
  const isServiceRequest = await verifyServiceApiKey(ctx.headers);
  if (isServiceRequest) return;

  if (!hasAnyRole(actorSession.user.role, globalAdminRoles)) {
    throw APIError.from(
      "FORBIDDEN",
      authError(
        "ADMIN_OR_SERVICE_API_KEY_REQUIRED",
        "Global admin session or service API key required",
      ),
    );
  }
};

const requireActorSession = async (
  ctx: GenericEndpointContext,
  actorUserId: string,
) => {
  const session = await getSessionFromCtx(ctx);
  if (!session) {
    throw APIError.from(
      "UNAUTHORIZED",
      authError("ACTOR_SESSION_REQUIRED", "Actor session required"),
    );
  }

  if (session.session.userId !== actorUserId) {
    throw APIError.from(
      "FORBIDDEN",
      authError(
        "ACTOR_SESSION_MISMATCH",
        "Actor session does not match actorUserId",
      ),
    );
  }

  return session;
};

export const organizationImpersonation = () =>
  ({
    id: "organization-impersonation",
    schema,
    endpoints: {
      organizationImpersonateUser: createAuthEndpoint(
        "/organization/impersonate-user",
        {
          method: "POST",
          body: bodySchema,
          requireHeaders: true,
          metadata: {
            openapi: {
              operationId: "organizationImpersonateUser",
              summary: "Create an organization impersonation session",
              description:
                "Server-only endpoint that creates a user session marked as impersonated by an organization actor.",
            },
          },
        },
        async (ctx) => {
          const actorSession = await requireActorSession(
            ctx,
            ctx.body.actorUserId,
          );
          await requireServiceApiKeyOrGlobalAdmin(ctx, actorSession);

          const [organizationRecord, actorUser, targetUser, targetUserRole] =
            await Promise.all([
              db
                .select({ id: organization.id })
                .from(organization)
                .where(eq(organization.id, ctx.body.organizationId))
                .limit(1),
              ctx.context.internalAdapter.findUserById(ctx.body.actorUserId),
              ctx.context.internalAdapter.findUserById(ctx.body.targetUserId),
              db
                .select({ role: authUser.role })
                .from(authUser)
                .where(eq(authUser.id, ctx.body.targetUserId))
                .limit(1),
            ]);

          if (!organizationRecord[0]) {
            throw APIError.from(
              "NOT_FOUND",
              authError("ORGANIZATION_NOT_FOUND", "Organization not found"),
            );
          }
          if (!actorUser) {
            throw APIError.from(
              "NOT_FOUND",
              authError("ACTOR_NOT_FOUND", "Actor not found"),
            );
          }
          if (!targetUser) {
            throw APIError.from(
              "NOT_FOUND",
              authError("USER_NOT_FOUND", "User not found"),
            );
          }
          if (hasAnyRole(targetUserRole[0]?.role, globalAdminRoles)) {
            throw APIError.from(
              "FORBIDDEN",
              authError(
                "TARGET_USER_ADMIN_IMPERSONATION_FORBIDDEN",
                "Organizations cannot impersonate admin users",
              ),
            );
          }

          const expiresInSeconds = ctx.body.expiresInSeconds ?? 60 * 60;
          const session = await ctx.context.internalAdapter.createSession(
            targetUser.id,
            true,
            {
              activeOrganizationId: ctx.body.organizationId,
              impersonatedBy: actorUser.id,
              impersonatedByOrganizationId: ctx.body.organizationId,
              expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
            },
            true,
          );

          if (!session) {
            throw APIError.from(
              "INTERNAL_SERVER_ERROR",
              authError(
                "FAILED_TO_CREATE_IMPERSONATION_SESSION",
                "Failed to create impersonation session",
              ),
            );
          }

          const authCookies = ctx.context.authCookies;
          deleteSessionCookie(ctx);
          const dontRememberMeCookie = await ctx.getSignedCookie(
            ctx.context.authCookies.dontRememberToken.name,
            ctx.context.secret,
          );
          const adminCookie = ctx.context.createAuthCookie("admin_session");
          await ctx.setSignedCookie(
            adminCookie.name,
            `${actorSession.session.token}:${dontRememberMeCookie || ""}`,
            ctx.context.secret,
            authCookies.sessionToken.attributes,
          );
          await setSessionCookie(ctx, { session, user: targetUser }, true);

          return ctx.json({ session, user: targetUser });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
