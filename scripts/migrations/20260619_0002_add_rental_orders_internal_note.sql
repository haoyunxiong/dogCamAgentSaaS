-- Phase 04 stage 1A additive migration.
-- Adds a local-only merchant internal note field for future safeOps order writes.
-- This file must not be executed without a verified backup and explicit local approval.

ALTER TABLE rental_orders
  ADD COLUMN internal_note TEXT NULL COMMENT '商家内部备注，仅本地内部操作使用，不同步外部平台';
