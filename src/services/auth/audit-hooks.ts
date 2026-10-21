import {
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
  isAPIError,
} from "better-auth/api";
import { tryGetCurrentAuthEndpointContext } from "@better-auth/core/context";
import { Events } from "@krak-stack/registry/events";
import { Config, Effect, Option, References, Schema } from "effect";
import { nativeAuditDiagnostic, nativeAuditOperation } from "./audit-policy";

const AuditState = Schema.Struct({
  operationId: Schema.String,
  operation: Schema.String,
  actorType: Schema.Literals(["user", "system"]),
  actorId: Schema.String,
  organizationId: Schema.String,
  priorSessionId: Schema.optional(Schema.String),
  sessionUserId: Schema.optional(Schema.String),
  twoFactorEnabled: Schema.optional(Schema.Boolean),
}).annotate({ identifier: "NativeAuthAuditState" });

const AppliedMutation = Schema.Struct({
  userId: Schema.String,
  kind: Schema.Literals([
    "user_created",
    "password_reset",
    "email_verified",
    "user_deleted",
    "session_revoked",
  ]),
}).annotate({ identifier: "NativeAuthAppliedMutation" });

// Only call from Better Auth's trusted post-mutation callbacks. No identity is
// read from request bodies, emails, tokens, synthetic responses or query params.
// This marker performs no I/O: in particular it must not interrupt password
// reset before BA revokes the user's old sessions.
export const markNativeAuthMutation = (
  mutation: typeof AppliedMutation.Type,
) => {
  const context = tryGetCurrentAuthEndpointContext();
  if (context)
    Object.assign(context.context, { krakstackAppliedMutation: mutation });
};

// Capture verified revocation evidence only for explicit security actions, not
// temporary 2FA sessions, TTL cleanup or password-reset implementation steps.
export const markNativeSessionRevocation = (userId: string) => {
  const context = tryGetCurrentAuthEndpointContext();
  if (
    context?.path &&
    [
      "/sign-out",
      "/revoke-session",
      "/revoke-sessions",
      "/revoke-other-sessions",
      "/admin/revoke-user-session",
      "/admin/revoke-user-sessions",
      "/oauth2/end-session",
      "/oauth2/end-session/confirm",
    ].includes(context.path)
  ) {
    markNativeAuthMutation({ userId, kind: "session_revoked" });
  }
};

type NativeAuditOutcome = {
  operationId: string;
  sessionIssued: boolean;
  issuedSessionId?: string;
  subjectUserId?: string;
  appliedMutation?: typeof AppliedMutation.Type.kind;
};
type NativeAuditAnnotations = {
  "app.actor.type": string;
  "app.actor.id": string;
  "organization.id": string;
  "user.id"?: string;
};

export const makeNativeAudit = (
  run: (effect: Effect.Effect<void, unknown, Events>) => Promise<void>,
) => {
  const before = createAuthMiddleware(async (ctx) => {
    const diagnostic = nativeAuditDiagnostic(ctx.path, Boolean(ctx.request));
    if (diagnostic) {
      await run(
        Effect.logDebug("Native auth action step").pipe(
          Effect.annotateLogs({
            "auth.step": diagnostic,
            "auth.endpoint": ctx.path,
          }),
        ),
      );
      return;
    }
    const operation = nativeAuditOperation(ctx.path, ctx.method ?? "POST");
    if (!operation) return;
    const session = await getAuthoritativeSessionFromCtx(ctx);
    const state = {
      operationId: crypto.randomUUID(),
      operation,
      actorType: session ? "user" : "system",
      actorId: session
        ? (session.session.impersonatedBy ?? session.user.id)
        : "better-auth",
      priorSessionId: session?.session.id,
      sessionUserId: session?.user.id,
      twoFactorEnabled: session?.user.twoFactorEnabled,
      organizationId: await Effect.runPromise(
        Config.String("VITE_KRAKSTACK_AUTH_ORGANIZATION_ID"),
      ),
    };
    // Attribution only. Audit availability must not gate the security action.
    return { context: { context: { krakstackAudit: state } } };
  });

  const after = createAuthMiddleware(async (ctx) => {
    // BA's adapter effects have already run; this is not their SQL transaction.
    // A success-audit failure cannot roll back a reset/session. In particular
    // this hook runs after BA has finished revoking sessions on password reset.
    const decoded = Schema.decodeUnknownOption(
      Schema.Struct({ krakstackAudit: AuditState }),
    )(ctx.context);
    if (Option.isNone(decoded)) return;
    const state = decoded.value.krakstackAudit;
    const returned = ctx.context.returned;
    const properties: NativeAuditOutcome = {
      operationId: state.operationId,
      sessionIssued: false,
    };
    const mutation = Schema.decodeUnknownOption(
      Schema.Struct({ krakstackAppliedMutation: AppliedMutation }),
    )(ctx.context);
    if (Option.isSome(mutation)) {
      const applied = mutation.value.krakstackAppliedMutation;
      const user = await ctx.context.internalAdapter.findUserById(
        applied.userId,
      );
      if (user || applied.kind === "user_deleted") {
        properties.subjectUserId = applied.userId;
        properties.appliedMutation = applied.kind;
      }
    }
    // This hook is installed LAST, after BA's two-factor hook has removed its
    // temporary session. A redirect is not proof of authentication; a live
    // server-issued session is. Tokens are used only for this internal lookup.
    const issued = ctx.context.newSession;
    if (issued && issued.session.id !== state.priorSessionId) {
      const authoritative = await ctx.context.internalAdapter.findSession(
        issued.session.token,
      );
      if (
        authoritative &&
        authoritative.user.id === issued.user.id &&
        authoritative.session.expiresAt > new Date()
      ) {
        properties.sessionIssued = true;
        properties.issuedSessionId = authoritative.session.id;
        properties.subjectUserId = authoritative.user.id;
      }
    }
    const result = Schema.decodeUnknownOption(
      Schema.Struct({
        status: Schema.optional(Schema.Unknown),
        success: Schema.optional(Schema.Boolean),
        error: Schema.optional(Schema.Unknown),
        redirect: Schema.optional(Schema.Boolean),
        url: Schema.optional(Schema.String),
        twoFactorRedirect: Schema.optional(Schema.Boolean),
      }).annotate({ identifier: "NativeActionResult" }),
    )(returned);
    let operation = state.operation;
    if (
      operation === "session.signed_in" &&
      properties.appliedMutation === "user_created"
    )
      operation = "user.registered";
    const factorVerification = [
      "/two-factor/verify-totp",
      "/two-factor/verify-otp",
      "/two-factor/verify-backup-code",
    ].includes(ctx.path);
    const enabledUser =
      (operation === "two_factor.enabled" || factorVerification) &&
      state.sessionUserId
        ? await ctx.context.internalAdapter.findUserById(state.sessionUserId)
        : null;
    const twoFactorEnabled = Schema.decodeUnknownOption(
      Schema.Struct({ twoFactorEnabled: Schema.Literal(true) }).annotate({
        identifier: "NativeEnabledTwoFactor",
      }),
    )(enabledUser);
    if (
      factorVerification &&
      state.sessionUserId &&
      !state.twoFactorEnabled &&
      Option.isSome(twoFactorEnabled)
    )
      operation = "two_factor.enabled";
    const requiresSession = [
      "session.signed_in",
      "session.impersonated",
      "session.impersonation_ended",
    ].includes(operation);
    const requiresMutation = [
      "user.registered",
      "password.reset",
      "email.verified",
      "user.email_changed",
      "user.deleted",
      "session.signed_out",
    ].includes(operation);
    const rejected = isAPIError(returned) && returned.statusCode >= 400;
    const evidence =
      properties.sessionIssued || properties.appliedMutation !== undefined;
    const ordinarySuccess =
      !isAPIError(returned) &&
      Option.isSome(result) &&
      result.value.status !== false &&
      result.value.success !== false &&
      result.value.error === undefined &&
      result.value.twoFactorRedirect !== true &&
      result.value.redirect !== true &&
      result.value.url === undefined;
    if (
      rejected ||
      (operation === "two_factor.enabled" && Option.isNone(twoFactorEnabled)) ||
      (factorVerification &&
        state.sessionUserId &&
        operation === "session.signed_in") ||
      (requiresSession
        ? !properties.sessionIssued
        : requiresMutation
          ? !properties.appliedMutation
          : !evidence && !ordinarySuccess)
    ) {
      await run(
        Effect.logDebug("Native auth action not completed").pipe(
          Effect.annotateLogs({
            "auth.operation": state.operation,
            "auth.operation_id": state.operationId,
          }),
        ),
      );
      return;
    }
    // A successful login/registration establishes identity after the before-hook.
    // Use only the authoritative session or trusted mutation evidence, never input.
    const authenticatingUser =
      state.actorType === "system" &&
      (operation === "session.signed_in" || operation === "user.registered")
        ? properties.subjectUserId
        : undefined;
    const actorType = authenticatingUser ? "user" : state.actorType;
    const actorId = authenticatingUser ?? state.actorId;
    const annotations: NativeAuditAnnotations = {
      "app.actor.type": actorType,
      "app.actor.id": actorId,
      "organization.id": state.organizationId,
    };
    if (actorType === "user") annotations["user.id"] = actorId;
    await run(
      Effect.gen(function* () {
        yield* (yield* Events).track({
          name: `auth.${operation}`,
          category: "audit",
          target: {
            id: state.operationId,
            name: state.operationId,
            type: "auth_operation",
          },
          properties,
        });
      }).pipe(
        Effect.provideService(References.CurrentLogAnnotations, annotations),
      ),
    );
  });

  return {
    hooks: { before },
    plugin: {
      id: "native-security-audit",
      hooks: { after: [{ matcher: () => true, handler: after }] },
    },
  };
};
