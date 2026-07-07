export { AuthService } from "../service";
export type {
  AuthSession,
  AuthSessionWithOrganization,
  AuthSessionWithUser,
  AuthSessionWithUserAndOrganization,
} from "../service";
export { AuthClientConfig } from "../config";
export {
  ServerApi,
  ServerDomainsApiGroup,
  ServerOrganizationsApiGroup,
  ServerUsersApiGroup,
} from "./api";
export { proxyAuthRequest } from "./proxy";
export {
  ApiKeySecurity,
  AuthMiddleware,
  makeAuthenticationLive,
} from "./middleware";
export type { AuthenticationLiveOptions } from "./middleware";
export {
  ServerActiveOrganization,
  ServerCreateDomainPayload,
  ServerDomain,
  ServerDomainHostParams,
  ServerDomainIdParams,
  ServerDomainRecordsResponse,
  ServerMembersResponse,
  ServerOrganizationsResponse,
  ServerUpdateDomainPayload,
  ServerUsersResponse,
} from "./schema";
export type {
  Member,
  Organization,
  OrganizationMetadata,
  User,
} from "../schema";
