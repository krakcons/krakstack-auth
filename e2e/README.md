# Email editor regressions

```sh
bunx playwright install chromium
bun run test:e2e -- e2e/email-editor.spec.ts
```

These tests mount the real editor and Effect atoms in a test-only Vite fixture.
HTTP responses are controlled per browser session; unexpected API calls are
blocked. No database, login, AWS credentials, or real email delivery is used.
The Paraglide Vite plugin generates fixture translations under ignored `tmp/`
without changing the application's generated runtime.

Vitest covers rendering/security, notification delivery, optimistic client state,
and PostgreSQL persistence separately. Database tests require `TEST_DATABASE_URL`.
Playwright retains traces and screenshots on failure under `test-results/`.
