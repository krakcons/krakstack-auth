import { Schema } from "effect";

export const OAuthAccessTokenClaims = Schema.Struct({
  sub: Schema.NonEmptyString,
  azp: Schema.NonEmptyString,
  exp: Schema.Finite,
  iat: Schema.Finite,
  scope: Schema.String,
  organization_id: Schema.NonEmptyString,
  // Sender-constrained tokens need request-bound proof verification. This
  // integration intentionally supports bearer tokens only, never strips cnf.
  cnf: Schema.optional(Schema.Never),
}).annotate({ identifier: "OAuthAccessTokenClaims" });

export type OAuthResourceOptions = {
  readonly issuer: string;
  readonly resource: string;
  readonly jwksUrl: string;
  readonly requiredScopes: readonly string[];
  /** Capabilities clients may request; not every request must hold all of them. */
  readonly scopesSupported?: readonly string[];
  /** Scope hint sent to clients starting or upgrading authorization. */
  readonly challengeScopes?: readonly string[];
  /** Defaults to read-only API access. MCP transport POSTs are handled separately. */
  readonly allowedMethods?: readonly string[];
  /** Required in addition to requiredScopes for non-GET/HEAD API requests. */
  readonly writeScope?: string;
};
