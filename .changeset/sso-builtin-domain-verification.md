---
"@krak-stack/auth": patch
---

Allow verified organization SSO settings to omit the DNS challenge token. Domain verification now uses Better Auth's built-in challenge lifecycle instead of custom provider token storage.
