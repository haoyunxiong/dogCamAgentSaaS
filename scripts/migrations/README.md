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
