-- WARNING: This rollback can lose merchant internal note data.
-- Manual reference only. Do not execute after any internal_note data has been written.
-- Do not run this file on production databases without explicit user approval.

ALTER TABLE rental_orders
  DROP COLUMN internal_note;
