# Email editor regressions

```sh
bunx playwright install chromium
bun run test:e2e -- e2e/email-editor.spec.ts
```

These tests mount the real editor and Effect atoms in a test-only Vite fixture.
HTTP responses are controlled per browser session; unexpected API calls are
blocked. No database, login, AWS credentials, or real email delivery is used.
Previews use the shared authentication email renderer with inert sample values.
The Paraglide Vite plugin generates fixture translations under ignored `tmp/`
without changing the application's generated runtime.

Coverage includes section editing and movement, bilingual text/link publication,
block capacity and deletion, local text colors and typography, retained legacy
settings, save failures and retries, scoped resets, unsaved navigation, the brand
switch, and non-persisting test delivery. Unsafe links and incomplete colors keep
the last valid preview and disable publication and test delivery.

Vitest covers rendering/security, notification delivery, optimistic client state,
and PostgreSQL persistence separately. Database tests require `TEST_DATABASE_URL`.
Run migrations with `bun run scripts/migrate.ts --test` before database tests;
never point `TEST_DATABASE_URL` at an application database.
Playwright retains traces and screenshots on failure under `test-results/`.
