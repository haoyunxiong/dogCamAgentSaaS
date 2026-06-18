# Database Migrations

This directory contains migration scaffolding for Phase 04 Operation Safe Mode.

Current migration files are not executed automatically. They are SQL scaffolds only.

Before running any migration:

- Create and verify a MySQL backup.
- Confirm the target database is local or test, not production.
- Get separate approval before any production database migration.
- Review the rollback boundary.
- Do not skip validation and run migrations directly.

Rollback files are only suitable before the new safeOps tables carry business audit data. After real safeOps writes begin, prefer forward repair migrations or restore from a verified dump.

## Protected runner

Use `scripts/run_safeops_migration.js` for future local/test execution. The runner is protected by git, environment, local-host, backup, precheck, checksum, ledger, verify, and rollback guards.

The runner does not execute by default:

```bash
node scripts/run_safeops_migration.js
```

Safe planning check:

```bash
SAFEOPS_MIGRATION_APPROVED=local node scripts/run_safeops_migration.js --dry-run
```

Local apply flow:

```bash
node scripts/backup_mysql.js
SAFEOPS_MIGRATION_APPROVED=local node scripts/run_safeops_migration.js --apply
SAFEOPS_MIGRATION_APPROVED=local node scripts/run_safeops_migration.js --verify
```

Rollback is refused unless the explicit risk flag is supplied and all `operation_*` tables are empty:

```bash
SAFEOPS_MIGRATION_APPROVED=local node scripts/run_safeops_migration.js --rollback --i-understand-rollback-risk
```
