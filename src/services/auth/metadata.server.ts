import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";

import { authForRequest } from "@/services/auth/config";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
};

export const openIdConfigurationHandler = async (request: Request) =>
  oauthProviderOpenIdConfigMetadata(await authForRequest(request), {
    headers: corsHeaders,
  })(request);

export const oauthAuthorizationServerHandler = async (request: Request) =>
  oauthProviderAuthServerMetadata(await authForRequest(request), {
    headers: corsHeaders,
  })(request);
