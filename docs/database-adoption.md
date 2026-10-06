# Verified database adoption

## Purpose

The timestamp-only Drizzle bridge is replaced by a current-schema initial
migration and a separate, explicit adoption command. Adoption never executes
historical SQL, changes application rows, or rewrites old migration records.

The initial DDL and expected table fingerprints were captured from an isolated
replay of the pre-handoff migrations on the `TEST_DATABASE_URL` cluster. They
were not copied from the database being adopted. Historical SQL has been removed
from the source tree; Git retains it for investigation.

## Fresh installation

With `DATABASE_URL` configured for the intended fresh database:

```sh
bun run db:migrate
```

The initial migration refuses to run when application objects already exist.
Startup runs ordinary Effect migrations via `bun run start`. Development does
not run migrations automatically. Include `scripts/` and `src/db/` in deployment
artifacts; the initial migration reads its SQL relative to its module, not the
process working directory.

## Existing databases

Take a backup, confirm the target database, and stop application writers for a
maintenance window. The operator needs schema/table read access, table-lock
permissions, and permission to create the Effect migration ledger.

From the repository root:

```sh
# Read-only check; no application data or migration records are changed.
bun run db:adopt -- --check

# After reviewing the check and confirming the target:
bun run db:adopt

# Ordinary migration runner thereafter:
bun run db:migrate
```

Do this even if the previous bridge already recorded migration 1. That bridge
trusted only the latest Drizzle timestamp; it did not establish schema compatibility.
Do not deploy on the strength of that old record alone.

Adoption verifies all 21 application tables: columns, types, defaults, nullability,
constraints and their validation, indexes, triggers, policies, and row security.
Physical column order and PostgreSQL 18's generated NOT NULL constraint names are
ignored; actual nullability is checked. Unrelated workflow tables are excluded.
Validated foreign keys and uniqueness constraints retain the database's essential
relationship and identity guarantees. Adoption does not normalize metadata,
regenerate sessions/API keys, backfill organizations, or repeat historical data
transformations. This establishes current-schema compatibility, not proof of
every historical data operation.

The write command rechecks under table locks and records only `(1, 'legacy')` in
`public.effect_sql_migrations`. The name is preserved for compatibility with
already-persisted Effect histories; it no longer implies historical SQL replay.
An existing exact baseline is verified without rewriting its ID, name, or timestamp.
An unexpected native history is rejected. Rejected adoption is rolled back.

Mismatches name the affected tables. Reconcile older or divergent schemas
separately; do not edit fingerprints to match a target database merely to bypass
verification. PostgreSQL versions can render definitions differently, and such
differences need investigation rather than automatic acceptance. The supplied
test cluster was validated; production compatibility is an operator check.

`--check` verifies the schema only; the write command additionally verifies the
native migration history. After future migrations change the baseline, do not
rerun adoption: use the normal versioned migrator.

## Test databases

Tests use `TEST_DATABASE_URL`, never `DATABASE_URL`.

```sh
# Existing test database: verify/adopt explicitly once.
bun run db:adopt:test -- --check
bun run db:adopt:test

# Fresh or adopted test database:
bun run db:migrate:test
bun run test
```

Migration tests allocate disposable databases on the configured test cluster,
require CREATE DATABASE privileges, and drop their own fixtures afterward.
Vitest discovers only source/SDK `*.test.ts` and `*.test.tsx` files, not temporary
Playwright scripts under `tmp/`.

## Future upgrades and rollback

Keep migration ID 1 and its persisted name `legacy`; never reuse or renumber it.
Add increasing numbered migrations to `src/db/migrate.ts`'s loader. Do not edit
the applied initial SQL or adoption fingerprints when adding future migrations.
Effect SQL runs migration changes transactionally; failures roll back their DDL
and ledger entries. Adoption and startup use the same advisory lock so concurrent
handoffs cannot race ledger creation.

Before any subsequent upgrade, take a backup and plan the application rollback.
Adoption does not remove or modify old ledgers, so application rollback does not
require reconstructing Drizzle history. Do not manually clear migration records
or replay initial SQL on a populated database.

No production database was accessed or adopted during implementation.

## Implementation validation

- Fresh disposable database: all **214 Vitest tests pass**, including **18
  baseline/adoption tests** and the Better Auth native PostgreSQL integration.
- Coverage includes the bogus-latest-timestamp regression, schema drift, complete
  application-row/legacy-ledger preservation, existing `1_legacy` compatibility,
  repeated execution, concurrent startup/adoption, and post-baseline rollback.
- The supplied existing test database passes `db:adopt:test -- --check`; its
  application rows and migration ledger were not changed by the handoff tooling.
- Production build, type checking, lint, and changed-file formatting pass.
