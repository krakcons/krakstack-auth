export { AuthService } from "../service";
export type {
  AuthSession,
  AuthSessionWithOrganization,
  AuthSessionWithUser,
  AuthSessionWithUserAndOrganization,
} from "../service";
export { AuthClientConfig } from "../config";
export {
  ServerDomainsApiGroup,
  ServerOrganizationsApiGroup,
  ServerUsersApiGroup,
} from "./api.group";
export { proxyAuthRequest } from "./proxy";
export type { ProxyAuthRequestOptions } from "./proxy";
export { ActorRequired } from "./actor";
export type { ActorConstraint } from "./actor";
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
  ServerOrganizationChildrenResponse,
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
export {
  ApiKeyPermissionGrant,
  CurrentActor,
  Forbidden,
  all,
  actorUserId,
  any,
  defineProjectAccess,
  permission,
  policy,
  withPolicy,
} from "../access";
export type {
  ApiKeyOwner,
  ApiKeyActor,
  Actor,
  Policy,
  ProjectAccessConfig,
  ProjectAccessCatalog,
  ProjectAccessDefinition,
  UserActor,
} from "../access";
