# Auth webhook release checklist

Preparation only: do not enable production deletion during this rollout.

## Configuration required before deployment

For each runtime consumer (template, 211-search, infrastructure, Kokobi learning,
courses and simulator):

1. In Auth admin, configure the project's Webhook URL as the consumer's reachable
   `https://<app-host>/api/webhooks/auth`. Confirm the exact project ID; do not infer
   it from the repository name.
2. Copy that endpoint's Signing secret into the consumer's server-only
   `KRAKSTACK_AUTH_WEBHOOK_SECRET` (at least 32 characters), and set
   `VITE_KRAKSTACK_AUTH_PROJECT_ID` to the same project. Never reuse `APP_SECRET`
   or expose the signing secret with a `VITE_` prefix.
3. Ensure the receiver uses the application's SQL pool and can run receipt
   migrations. Missing project/secret configuration intentionally prevents startup.
4. Upgrade sender and receivers together: auth `0.2.32`, registry `0.1.61`.
   Legacy timestamp/body-only signatures are not accepted.
5. Keep central Auth's `NODE_ENV=production`. Confirm direct user deletion,
   admin user removal and organization deletion are denied, not merely hidden.

The docs site uses auth only in examples and does not need a webhook receiver.
Volunteer-rebuild is excluded. The detached `kokobi-main` worktree is not changed.

## Callback readiness

| Consumer         | User deletion                                                            | Organization deletion                                                   |
| ---------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Template         | Detach creator from organization-owned tasks                             | Delete that organization's demo tasks                                   |
| 211-search       | No identity-owned catalog rows                                           | Preserve shared public catalog                                          |
| Kokobi learning  | Remove user progress, connections and notifications                      | Remove tenant-owned records and relationships; preserve foreign content |
| Infrastructure   | Fail without acknowledging; ownership/credential retention review needed | Fail without acknowledging; cloud teardown/backup policy needed         |
| Kokobi courses   | Fail without acknowledging; shared authorship/history policy needed      | Fail without acknowledging; content/object storage workflow needed      |
| Kokobi simulator | Fail without acknowledging; training history policy needed               | Fail without acknowledging; history/export retention policy needed      |

These callbacks do not claim complete personal-data erasure from audit/analytics
systems, processors, exports or backups. Review those separately before enabling
deletion. A failed callback returns 500 and rolls back the receipt so retries can
run after a reviewed cleanup implementation is supplied.

## Verification and rollback

- Test valid signed delivery, invalid signature, wrong project, duplicate delivery,
  conflicting replay and cleanup failure/rollback against a test database only.
- Confirm tenant isolation and that receipt persistence commits with cleanup.
- Verify consumer startup with deployment configuration before routing traffic.
- Plan receipt expiry with `WebhooksReceiver.cleanup()`; handlers must stay idempotent.
- If the rollout fails, keep deletion disabled and roll back sender/receivers as
  a compatible set. Do not drop receipts or manually acknowledge failed cleanup.

No production endpoint registrations, signing secrets, deployments or live deletion
requests are changed by this preparation.

## Preparation validation (2026-11-02)

- Production builds passed for Auth/SDK, template, 211-search, infrastructure,
  docs site, and Kokobi learning/courses/simulator.
- Focused deletion tests passed, including the native production organization
  denial, server user-removal guard, signed delivery, failed-cleanup rollback,
  replay conflict, deduplication and tenant isolation. Infrastructure's test
  command also ran its suite: 761 passed, 42 skipped.
- Type checks passed for Auth, template, 211-search, infrastructure and Kokobi.
  The docs site's type check remains blocked by three `fetch.preconnect` mock
  errors in the unmodified `src/services/speech/index.test.ts`.
- Deployment project IDs, endpoint registrations and signing secrets still need
  operator configuration. Unsafe callbacks intentionally remain blocked.
