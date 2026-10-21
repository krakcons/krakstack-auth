---
"@krak-stack/auth": patch
---

Include trusted OpenTelemetry user.full_name and user.email annotations for cookie sessions and user-owned API keys. Preserve effective-user attribution during impersonation and clear inherited profile fields for anonymous and organization-owned credentials.
