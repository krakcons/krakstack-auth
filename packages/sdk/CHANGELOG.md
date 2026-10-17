# @krak-stack/auth

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
