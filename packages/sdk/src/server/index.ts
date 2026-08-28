export { AuthService } from "../service.js";
export type {
  AuthSession,
  AuthSessionWithOrganization,
  AuthSessionWithUser,
  AuthSessionWithUserAndOrganization,
} from "../service.js";
export { AuthClientConfig } from "../config.js";
export {
  ServerDomainsApiGroup,
  ServerOrganizationsApiGroup,
  ServerUsersApiGroup,
} from "./api.group.js";
export {
  proxyAuthHttpEffect,
  proxyAuthRequest,
  proxyAuthRequestEffect,
} from "./proxy.js";
export type { ProxyAuthRequestOptions } from "./proxy.js";
export { ActorRequired } from "./actor.js";
export type { ActorConstraint } from "./actor.js";
export {
  ApiKeySecurity,
  AuthMiddleware,
  makeAuthenticationLive,
} from "./middleware.js";
export type { AuthenticationLiveOptions } from "./middleware.js";
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
} from "./schema.js";
export type {
  Member,
  Organization,
  OrganizationMetadata,
  User,
} from "../schema.js";
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
} from "../access.js";
export type {
  ApiKeyOwner,
  ApiKeyActor,
  Actor,
  Policy,
  ProjectAccessConfig,
  ProjectAccessCatalog,
  ProjectAccessDefinition,
  UserActor,
} from "../access.js";
