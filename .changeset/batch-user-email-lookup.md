---
"@krak-stack/auth": minor
---

Add `AuthService.users.listUsersByEmails` for trusted batch lookup by primary email. Return users with their saved locale and a list of missing emails. Match emails case-insensitively, trim whitespace, and deduplicate results in request order.
