-- WARNING: This rollback is only allowed before safeOps tables carry business audit data.
-- Do not run this file on production databases without explicit user approval.
-- The schema_migrations table is intentionally preserved because it may contain other records.
-- No existing business table is dropped by this rollback.

DROP TABLE IF EXISTS operation_rollback_plans;
DROP TABLE IF EXISTS operation_idempotency_keys;
DROP TABLE IF EXISTS operation_confirm_tokens;
DROP TABLE IF EXISTS operation_audit_logs;
