# @krak-stack/auth

## 0.2.27

### Patch Changes

- 8254748: Include trusted OpenTelemetry user.full_name and user.email annotations for cookie sessions and user-owned API keys. Preserve effective-user attribution during impersonation and clear inherited profile fields for anonymous and organization-owned credentials.

## 0.2.26

### Patch Changes

- Automatically synchronize the signed-in user's preferred locale from the existing KrakstackProvider context through KrakstackAuthProvider. Existing consumers need only update the SDK version after the auth server has been deployed with locale support; no selector wrapper, provider prop, or consumer database migration is required. Skip synchronization during impersonation, preserve optimistic session updates with rollback, and expose optional onLocaleSyncError handling. The current interface locale is authoritative, including on provider mount and after a page reload.

## 0.2.25

### Patch Changes

- Require `@krak-stack/registry` version `^0.1.52` for the coordinated audit attribution and telemetry integration.

- Actor authorization adds standard `user.roles` from the current organization membership for historical audit snapshots, without confusing global roles or organization API keys with human members. Auth emits IDs and roles only, not names/photos. Clear inherited profile/role annotations alongside other auth attribution. Audit display names/photos are resolved dynamically from current organization membership.

  Separate the responsible principal (`app.actor.type/id`, user or organization) from authentication (`app.auth.method`, session or api_key) and API-key record identity (`app.auth.credential.id`). Replace inherited authentication annotations together with actor annotations; never emit credentials or session tokens.

  Emit `app.auth.impersonator.id` from a verified session's `impersonatedBy`, preserving the effective user's actor ID. Keep organization impersonation route restrictions unchanged and clear stale impersonator annotations for ordinary or anonymous requests.

- 32213bb: Add verified actor type/ID and API-key owner type/ID to AuthMiddleware log and span annotations, preserving existing user and organization attribution. Distinguish API-key principals from their owners without emitting credentials or changing the authentication model. This enables audit recording through inherited telemetry context; MCP and AI context remain integration-owned.

  Replace the complete auth-owned annotation set so organization keys cannot inherit stale user IDs and users cannot inherit API-key owners. Preserve unrelated annotations and restore scoped log/child-span context after the handler. Clear stale fields on the already-created current span using empty strings because the tracer interface does not expose attribute removal.

  Provide the same optional authentication and attribution for plain HttpRouter routes through AuthMiddleware.routerLayer, with optional exact-path scoping. Anonymous requests clear inherited attribution; auth service failures remain explicit. ActorRequired continues to own project authorization and CurrentActor without reconstructing telemetry attribution.

## 0.2.24

### Patch Changes

- Improve the sign-in flow by moving email-code/password switching into the alternative options below the primary action. Replace the inline email-change link with a Back control so users can return to the initial screen and choose Google. Persist successful code-send timestamps in local storage to preserve the resend cooldown across method switches and reloads, and reuse unexpired codes instead of sending duplicate emails when switching back to email code.

## 0.2.23

### Patch Changes

- Add a reusable Effect Form `PasswordField` with optional recovery for existing-password prompts. Password sign-in sends recovery email for the entered address before opening the confirmation page, while account revocation, password changes, and two-factor settings send recovery email inline. Share request state, resend cooldowns, and confirmation controls across public recovery and account settings without adding router dependencies to the shared flow.

  Preserve recovery confirmation across refreshes without resending email, accept plain and JSON-quoted confirmation timestamps, retain OAuth and return-destination context, and clear browser session cookies after a successful password reset. Include English and French recovery messages and regression coverage for OTP-only accounts, token reuse, and session revocation.

  Use link-style Back controls above nested account-security and API-key dialog headings. Keep the active security page visible through the closing animation and reset nested state only after the dialog finishes closing, preventing the default page from flashing.

  Use the registry's built-in list columns for organization and project memberships and user, organization, and admin API-key permissions, replacing custom list-summary cell renderers.

  Show the account's sign-in email as its default, read-only primary contact email. Preserve it when saving contact details and exclude duplicate copies from the editable contact-email list.

## 0.2.22

### Patch Changes

- Update the KrakStack registry development dependency and minimum peer requirement to `0.1.48` for corrected image previews, full-width image inputs, file metadata, and non-overlapping replace/delete actions. Use compact, consistently sized icon and logo previews in account and organization forms without changing suggested upload resolutions.

## 0.2.21

### Patch Changes

- Reload the current page after impersonation instead of navigating to `/` or refreshing the previous user's mounted guards. This clears stale router and organization query state when switching identities while preserving the current URL.

  Update the SDK's KrakStack registry development dependency and minimum peer requirement to `0.1.44`.
