---
"@krak-stack/auth": minor
---

Require onDeleteUser when calling AuthMiddleware.layer. Projects provide their SQL cleanup callback; the middleware reads signing configuration, mounts the endpoint, and uses registry WebhooksReceiver for transactional deduplication. No separate auth-webhook service is needed. The layer now requires SQL; the former bare-auth-layer argument must be passed as authLayer in the options object.
