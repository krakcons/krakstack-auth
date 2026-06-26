import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import { Effect } from "effect";

import { BetterAuthRequest } from "@/services/auth/better-auth-request";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
};

export const openIdConfigurationHandler = async (request: Request) =>
  oauthProviderOpenIdConfigMetadata(
    (
      await Effect.runPromise(
        BetterAuthRequest.pipe(Effect.provide(BetterAuthRequest.make(request))),
      )
    ).auth,
    { headers: corsHeaders },
  )(request);

export const oauthAuthorizationServerHandler = async (request: Request) =>
  oauthProviderAuthServerMetadata(
    (
      await Effect.runPromise(
        BetterAuthRequest.pipe(Effect.provide(BetterAuthRequest.make(request))),
      )
    ).auth,
    { headers: corsHeaders },
  )(request);
