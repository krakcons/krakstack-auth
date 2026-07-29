# Cross-Project Authorization Migration

## Goal

Use one permission vocabulary for signed-in organization members and API keys
across KrakStack projects. Better Auth remains responsible for identities,
memberships, roles, API-key ownership, key grants, verification, expiry, and
rate limits. Effect policies are responsible for application authorization.

The policy design follows
[Building a Composable Policy System in TypeScript with Effect](https://lucas-barake.github.io/building-a-composable-policy-system/):

- roles group permissions for people;
- application code checks permissions, never role names;
- the authenticated actor and resolved permissions are carried in Effect
  context;
- policies succeed with `void` or fail with `Forbidden`;
- `all` and `any` compose permission and resource policies;
- domain services add tenant, ownership, and other attribute policies.

## Invariants

1. The only top-level actors are `user` and `apiKey`.
2. A user receives the union of permissions granted by their current
   organization roles.
3. A user-owned API key receives the intersection of its owner's live role
   permissions and the key's Better Auth grants.
4. An organization-owned or service API key receives only its Better Auth
   grants.
5. Empty, missing, unknown, and cross-project key grants authorize nothing.
6. Organization context alone never authorizes an application operation.
7. Every database operation remains scoped to the active organization after a
   coarse permission policy succeeds.
8. Browser permission checks only control presentation. Server policies are
   authoritative.
9. API keys are verified once per request. Composed policies evaluate the
   verified grant locally and do not consume key quota more than once.
10. Enabling organization-key verification is the last step for a project, not
    the first.

## Permission Format

Projects define local `domain:action` permissions and a stable project name.
The SDK qualifies them as `project:domain:action` in Effect context. Better
Auth stores its native resource/action representation:

```json
{
  "211-search": ["search:execute", "records:read"],
  "kokobi": ["courses:read"]
}
```

Each project definition contains:

- all valid permissions;
- grants for `owner`, `admin`, `support`, and `member` roles;
- permissions assignable to user-owned keys;
- permissions assignable to organization-owned keys;
- labels for public UI where needed.

## Delivery Phases

### Phase 1: Shared SDK

- Add typed project access definitions.
- Add `CurrentActor` and `Forbidden`.
- Add composable Effect policies.
- Decode and encode Better Auth permission records with Effect Schema.
- Resolve role grants, key grants, and user-key intersections.
- Add unit tests for deny-by-default and policy composition.
- Publish as an additive SDK release. Existing middleware behavior is
  unchanged.

### Phase 2: Provider And Key Management

- Pass a project access definition to `KrakstackAuthProvider`.
- Add `usePermissions` for the active signed-in member.
- Make `UserButton` use the provider's user-key catalog by default.
- Make `OrganizationSwitcher` use the provider's organization-key catalog.
- Preserve grants for other projects when updating one project's key grants.
- Add a server-only permission update endpoint backed by Better Auth's
  `updateApiKey` API.
- Validate requested grants against the project's assignable catalog.
- Configure empty default permissions for new user and organization keys.

### Phase 3: Template

- Define task permissions and role grants.
- Replace direct role/user assumptions with policies.
- Demonstrate user session, user-key intersection, and deny-by-default behavior.
- Update examples and package documentation before other consumers migrate.

### Phase 4: 211 Search

- Start with `search:execute`, `records:read`, and `categories:read` as
  organization-key-assignable permissions.
- Keep admin reads and writes user-only until explicitly classified.
- Replace `MemberRequired` and `ParentOrganizationRequired` as authorization
  decisions with permission policies plus organization-scoped data access.
- Move anonymous website data loading behind a first-party server boundary.
- Add organization and key IDs to API usage analytics.
- Enable organization-key verification only after every API operation has a
  policy test.

### Phase 5: Kokobi

- Define folder, course, collection, learner, webhook, and organization
  permissions from the existing local role statements.
- Replace role checks with permission policies.
- Classify every `requireOrganization()` call as public, user-only, or
  key-capable.
- Fix resource lookups that are not organization scoped.
- Protect learner data and unguarded mutations with explicit policies.
- Enable organization keys only after the endpoint matrix passes.

### Phase 6: Infrastructure

- Preserve cookie-only administration.
- Represent the existing release automation as `release:create`.
- Scope release credentials to allowed projects if global release authority is
  not intended.
- Do not enable organization keys for administrative groups without an
  explicit automation use case.

### Phase 7: Major Default Change

- Deprecate authentication helpers that callers commonly treat as
  authorization.
- Update package documentation to require a verified actor and policy.
- Make new templates deny API-key access unless an endpoint declares a
  permission.
- Remove legacy component permission props after provider-based configuration
  is adopted.

## Required Test Matrix

Every key-capable operation must cover:

| Actor                                               | Required result |
| --------------------------------------------------- | --------------- |
| User whose role grants the permission               | Allow           |
| User whose role lacks the permission                | Forbid          |
| User key whose role and key both grant it           | Allow           |
| User key whose role grants it but key does not      | Forbid          |
| User key whose key grants it but live role does not | Forbid          |
| Organization key with the permission                | Allow           |
| Organization key without the permission             | Forbid          |
| Key with only another project's permission          | Forbid          |
| Key with empty permissions                          | Forbid          |
| Invalid, expired, disabled, or revoked key          | Unauthorized    |

Domain tests must additionally prove organization and resource scoping.

## Release Gates

A project may enable organization-key verification only when:

- all non-public endpoints require a policy;
- all key-capable endpoints declare an assignable permission;
- all other endpoints explicitly reject API-key actors;
- resource queries are tenant scoped;
- OpenAPI security matches runtime behavior;
- key grants and raw credentials are absent from logs and analytics;
- the required test matrix passes.
