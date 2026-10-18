---
"@krak-stack/auth": patch
---

Add verified actor type/ID and API-key owner type/ID to AuthMiddleware log and span annotations, preserving existing user and organization attribution. Distinguish API-key principals from their owners without emitting credentials or changing the authentication model. This enables audit recording through inherited telemetry context; MCP and AI context remain integration-owned.

Replace the complete auth-owned annotation set so organization keys cannot inherit stale user IDs and users cannot inherit API-key owners. Preserve unrelated annotations and restore scoped log/child-span context after the handler. Clear stale fields on the already-created current span using empty strings because the tracer interface does not expose attribute removal.

Provide the same optional authentication and attribution for plain HttpRouter routes through AuthMiddleware.routerLayer, with optional exact-path scoping. Anonymous requests clear inherited attribution; auth service failures remain explicit. ActorRequired continues to own project authorization and CurrentActor without reconstructing telemetry attribution.
