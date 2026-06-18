-- xianyu_agent MySQL schema
USE xianyu_agent;

CREATE TABLE IF NOT EXISTS config (
  `key` VARCHAR(255) PRIMARY KEY NOT NULL,
  `value` TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prompts (
  name VARCHAR(255) PRIMARY KEY NOT NULL,
  content LONGTEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS knowledge (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id VARCHAR(255),
  scope_type VARCHAR(50) NOT NULL DEFAULT 'global',
  model_code VARCHAR(100),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  -- tags 约定：逗号分隔或 JSON 数组，词表固定为
  --   faq / usage / feature / accessory / compat / schedule / price / shipping / aftersale / booking
  -- 其中 price / schedule / shipping / aftersale / booking 属于"结构化类目"，
  -- 命中后不会直接自动回复（由 KNOWLEDGE_CATEGORY_BLACKLIST 控制）。
  tags TEXT,
  source_type VARCHAR(50) NOT NULL DEFAULT 'manual',
  status VARCHAR(50) NOT NULL DEFAULT 'approved',
  confidence_threshold DOUBLE DEFAULT 0.75,
  embedding LONGBLOB,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_knowledge_item_id (item_id),
  INDEX idx_knowledge_scope (scope_type, model_code, status)
) ENGINE=InnoDB;

-- Sprint 2+: 商品 → 业务商品 / 型号显式绑定表（优先级高于关键词推断）
CREATE TABLE IF NOT EXISTS item_model_mapping (
  item_id VARCHAR(255) PRIMARY KEY,
  model_code VARCHAR(100),
  biz_item_code VARCHAR(100),
  source VARCHAR(32) NOT NULL DEFAULT 'manual', -- manual | inferred | listing_sync | detail_sync
  note VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_item_model_mapping_model (model_code),
  INDEX idx_item_model_mapping_biz (biz_item_code)
) ENGINE=InnoDB;

-- 当前账号闲鱼帖子缓存 / 审核表：仅保存已同步/已缓存帖子，按账号隔离
CREATE TABLE IF NOT EXISTS xianyu_item_listings (
  account_id VARCHAR(64) NOT NULL,
  item_id VARCHAR(255) NOT NULL,
  title VARCHAR(500),
  description TEXT,
  cover_url TEXT,
  sold_price DECIMAL(10,2) DEFAULT 0,
  quantity INT DEFAULT 0,
  biz_item_code VARCHAR(100),
  model_code VARCHAR(100),
  owner_account_id VARCHAR(64),
  code_source VARCHAR(64),
  raw_json LONGTEXT,
  sync_source VARCHAR(64) NOT NULL DEFAULT 'local_cache',
  review_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  detail_updated_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, item_id),
  INDEX idx_xianyu_item_listings_account (account_id, review_status),
  INDEX idx_xianyu_item_listings_biz (biz_item_code),
  INDEX idx_xianyu_item_listings_model (model_code),
  INDEX idx_xianyu_item_listings_owner (owner_account_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS deposit_orders (
  deposit_order_no VARCHAR(120) PRIMARY KEY,
  order_id INT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'order',
  source_order_id VARCHAR(120) NULL,
  source_order_no VARCHAR(255) NULL,
  product_name VARCHAR(255) NULL,
  model_code VARCHAR(100) NULL,
  unit_code VARCHAR(100) NULL,
  customer_name VARCHAR(255) NULL,
  customer_phone VARCHAR(64) NULL,
  deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  rent_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  rent_start_date VARCHAR(20) NULL,
  rent_end_date VARCHAR(20) NULL,
  rent_days INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
  status_label VARCHAR(64) NULL,
  review_url TEXT NULL,
  qr_image_url TEXT NULL,
  is_latest TINYINT(1) NOT NULL DEFAULT 1,
  third_party_created_at DATETIME NULL,
  third_party_updated_at DATETIME NULL,
  last_event_type VARCHAR(64) NULL,
  last_event_source VARCHAR(64) NULL,
  last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  raw_snapshot_json LONGTEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_deposit_orders_source_order (source_order_id, source_order_no),
  INDEX idx_deposit_orders_status (status, updated_at),
  INDEX idx_deposit_orders_model (model_code, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS deposit_order_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  deposit_order_no VARCHAR(120) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  event_source VARCHAR(64) NOT NULL DEFAULT 'unknown',
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NULL,
  payload_json LONGTEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_deposit_order_events_order (deposit_order_no, created_at DESC),
  INDEX idx_deposit_order_events_type (event_type, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS item_cache (
  item_id VARCHAR(255) PRIMARY KEY,
  data LONGTEXT NOT NULL,
  price DECIMAL(10,2) NULL,
  description TEXT NULL,
  biz_item_code VARCHAR(100) NULL,
  biz_item_code_source VARCHAR(100) NULL,
  detail_source VARCHAR(100) NULL,
  detail_updated_at DATETIME NULL,
  detail_dirty TINYINT(1) NOT NULL DEFAULT 0,
  dirty_reason TEXT NULL,
  last_refresh_attempt_at DATETIME NULL,
  refresh_fail_count INT NOT NULL DEFAULT 0,
  refresh_backoff_until DATETIME NULL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_item_cache_biz (biz_item_code),
  INDEX idx_item_cache_updated (detail_updated_at, last_updated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sprint 3: 租赁价格分档表（按租期天数命中 min_days..max_days 区间）
CREATE TABLE IF NOT EXISTS rental_pricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_code VARCHAR(100) NOT NULL,
  min_days INT NOT NULL,
  max_days INT NOT NULL,
  daily_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NULL,
  deposit DECIMAL(10,2) NOT NULL DEFAULT 0,
  remark VARCHAR(255),
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pricing_model (model_code, active)
) ENGINE=InnoDB;

-- Sprint 5: 建单草稿状态机（session 级活跃草稿）
CREATE TABLE IF NOT EXISTS booking_drafts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  item_id VARCHAR(255),
  model_code VARCHAR(100),
  buyer_id VARCHAR(255),
  state VARCHAR(50) NOT NULL,
  slots_json JSON NOT NULL,
  quote_json JSON,
  last_user_message TEXT,
  last_bot_message TEXT,
  feishu_task_id VARCHAR(255),
  order_id INT,
  closed_reason VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_booking_state (state, updated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS takeover_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  item_id VARCHAR(255),
  model_code VARCHAR(100),
  latest_question TEXT,
  reason VARCHAR(255) NOT NULL,
  priority VARCHAR(50) NOT NULL DEFAULT 'normal',
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  notified_at DATETIME,
  accepted_at DATETIME,
  expired_at DATETIME,
  escalated_at DATETIME,
  assigned_to VARCHAR(255),
  resolution TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_takeover_status (status, created_at DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS schedule_units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_code VARCHAR(100) NOT NULL,
  unit_code VARCHAR(100) NOT NULL UNIQUE,
  serial_no VARCHAR(255),
  city VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'idle',
  note TEXT,
  purchase_cost DOUBLE DEFAULT 0,
  residual_value DOUBLE DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_schedule_units_model (model_code, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rental_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255),
  order_no VARCHAR(255) UNIQUE,
  model_code VARCHAR(100) NOT NULL,
  unit_id INT,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  province VARCHAR(100),
  city VARCHAR(100),
  district VARCHAR(100),
  address TEXT,
  rent_start_date VARCHAR(20) NOT NULL,
  rent_end_date VARCHAR(20) NOT NULL,
  fee DOUBLE DEFAULT 0,
  deposit DOUBLE DEFAULT 0,
  order_status VARCHAR(50) NOT NULL DEFAULT 'waiting_payment',
  planned_ship_at VARCHAR(30),
  actual_ship_at VARCHAR(30),
  expected_arrive_at VARCHAR(30),
  tracking_no VARCHAR(255),
  shipping_mode VARCHAR(50),
  latest_logistics_status TEXT,
  source_channel VARCHAR(50),
  source_name VARCHAR(255),
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_status (order_status, rent_start_date, rent_end_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inquiry_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(64) NOT NULL DEFAULT 'unknown',
  store_id INT NULL,
  chat_id VARCHAR(255),
  message_id VARCHAR(255),
  raw_text TEXT,
  model_code VARCHAR(100),
  rent_start_date DATE NULL,
  rent_end_date DATE NULL,
  rent_days INT NOT NULL DEFAULT 0,
  province VARCHAR(100),
  city VARCHAR(100),
  district VARCHAR(100),
  address TEXT,
  shipping_mode VARCHAR(32) DEFAULT 'land',
  available TINYINT(1) NOT NULL DEFAULT 0,
  total_unit_count INT NOT NULL DEFAULT 0,
  available_unit_count INT NOT NULL DEFAULT 0,
  conflict_unit_count INT NOT NULL DEFAULT 0,
  quoted_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  quote_days INT NOT NULL DEFAULT 0,
  deposit_summary TEXT,
  planned_ship_at DATETIME NULL,
  expected_arrive_at DATETIME NULL,
  ship_date DATE NULL,
  arrive_date DATE NULL,
  availability_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
  order_id INT NULL,
  final_fee DECIMAL(10,2) NULL,
  converted_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_inquiry_events_created (created_at),
  INDEX idx_inquiry_events_model_created (model_code, created_at),
  INDEX idx_inquiry_events_store_created (store_id, created_at),
  INDEX idx_inquiry_events_order (order_id),
  INDEX idx_inquiry_events_chat (source, chat_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unit_id INT,
  order_id INT,
  model_code VARCHAR(100) NOT NULL,
  block_type VARCHAR(50) NOT NULL,
  start_date VARCHAR(20) NOT NULL,
  end_date VARCHAR(20) NOT NULL,
  planned_ship_at VARCHAR(30),
  expected_arrive_at VARCHAR(30),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_schedule_blocks_model (model_code, start_date, end_date),
  INDEX idx_schedule_blocks_unit (unit_id, start_date, end_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shipping_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  carrier VARCHAR(50) NOT NULL DEFAULT 'sf',
  tracking_no VARCHAR(255),
  shipping_mode VARCHAR(50),
  latest_status TEXT,
  ship_from_city VARCHAR(100),
  ship_to_city VARCHAR(100),
  planned_ship_at VARCHAR(30),
  actual_ship_at VARCHAR(30),
  expected_arrive_at VARCHAR(30),
  actual_arrive_at VARCHAR(30),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sf_shipments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shipment_no VARCHAR(80) NOT NULL UNIQUE,
  linked_order_id INT NULL,
  service_kind VARCHAR(32) NOT NULL DEFAULT 'express',
  product_code VARCHAR(40) NOT NULL,
  express_type_id INT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  sender_name VARCHAR(100),
  sender_mobile VARCHAR(50),
  sender_province VARCHAR(100),
  sender_city VARCHAR(100),
  sender_district VARCHAR(100),
  sender_address TEXT,
  receiver_name VARCHAR(100),
  receiver_mobile VARCHAR(50),
  receiver_province VARCHAR(100),
  receiver_city VARCHAR(100),
  receiver_district VARCHAR(100),
  receiver_address TEXT,
  cargo_name VARCHAR(100),
  weight_kg DECIMAL(10,3) NOT NULL DEFAULT 1,
  pay_method INT NOT NULL DEFAULT 1,
  monthly_card_tail VARCHAR(8),
  tracking_no VARCHAR(255),
  planned_send_at VARCHAR(30),
  expected_arrive_at VARCHAR(30),
  filter_result INT NULL,
  quote_fee DECIMAL(10,2) NULL,
  estimated_fee DECIMAL(10,2) NULL,
  billed_fee DECIMAL(10,2) NULL,
  actual_paid_fee DECIMAL(10,2) NULL,
  actual_paid_source VARCHAR(32) NULL,
  actual_paid_note TEXT NULL,
  expense_record_id INT NULL,
  service_message TEXT,
  precheck_result_json JSON NULL,
  submit_result_json JSON NULL,
  promise_result_json JSON NULL,
  billed_fee_detail_json JSON NULL,
  cancel_result_json JSON NULL,
  routes_result_json JSON NULL,
  fee_result_json JSON NULL,
  cancelled_at DATETIME NULL,
  routes_updated_at DATETIME NULL,
  fee_updated_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sf_shipments_status (status, created_at DESC),
  INDEX idx_sf_shipments_order (linked_order_id, created_at DESC),
  INDEX idx_sf_shipments_tracking (tracking_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sf_shipment_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shipment_id INT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  status VARCHAR(32),
  message TEXT,
  detail_json JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sf_shipment_events_shipment (shipment_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255),
  item_id VARCHAR(255),
  model_code VARCHAR(100),
  question TEXT NOT NULL,
  final_answer TEXT NOT NULL,
  source_message_ids TEXT,
  candidate_scope VARCHAR(50) NOT NULL DEFAULT 'global',
  tags TEXT,
  review_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reviewer VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  INDEX idx_learning_review (review_status, created_at DESC)
) ENGINE=InnoDB;

-- Sprint 6：结构化候选（砍价 / 档期 / 售后 / 物流 / 下单 等），不进知识库
CREATE TABLE IF NOT EXISTS structured_learning_suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_session_id VARCHAR(255),
  item_id VARCHAR(255),
  model_code VARCHAR(100),
  category VARCHAR(32) NOT NULL,
  user_message TEXT,
  bot_or_human_reply TEXT,
  suggested_slot_json JSON,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  note VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sls_category (category, status),
  INDEX idx_sls_model (model_code, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS feishu_pending_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  item_id VARCHAR(255),
  model_code VARCHAR(100),
  user_question TEXT NOT NULL,
  ai_draft TEXT,
  search_result TEXT,
  reply_type VARCHAR(50) NOT NULL DEFAULT 'faq_miss',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  final_reply TEXT,
  approved_by VARCHAR(255),
  feishu_message_id VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_feishu_pending_status (status, created_at DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS market_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_code VARCHAR(100) NOT NULL,
  snapshot_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_listings INT DEFAULT 0,
  avg_price DOUBLE DEFAULT 0,
  min_price DOUBLE DEFAULT 0,
  max_price DOUBLE DEFAULT 0,
  median_price DOUBLE DEFAULT 0,
  sold_count INT DEFAULT 0,
  price_band_json TEXT,
  source VARCHAR(50) NOT NULL DEFAULT 'xianyu',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_market_snapshots_model (model_code, snapshot_time DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS market_listings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  snapshot_id INT NOT NULL,
  model_code VARCHAR(100) NOT NULL,
  listing_id VARCHAR(255) NOT NULL,
  title TEXT,
  price DOUBLE DEFAULT 0,
  seller_name VARCHAR(255),
  location VARCHAR(255),
  is_rental TINYINT DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_market_listings_model (model_code, listing_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expense_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_code VARCHAR(100) NOT NULL,
  unit_id INT,
  expense_type VARCHAR(50) NOT NULL,
  amount DOUBLE NOT NULL DEFAULT 0,
  description TEXT,
  expense_date VARCHAR(20) NOT NULL,
  order_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_expense_model (model_code, expense_date),
  INDEX idx_expense_type (expense_type, expense_date)
) ENGINE=InnoDB;

-- 会话回复状态机：解决默认回复重复发送、感知人工介入
-- state: auto | cooldown | human_active | manual
CREATE TABLE IF NOT EXISTS session_reply_state (
  session_id VARCHAR(255) PRIMARY KEY,
  account_id INT DEFAULT 1,
  state VARCHAR(30) NOT NULL DEFAULT 'auto',
  cooldown_since DATETIME NULL,
  last_notify_at DATETIME NULL,
  last_human_msg_at DATETIME NULL,
  last_buyer_msg_at DATETIME NULL,
  last_default_reply_at DATETIME NULL,
  default_reply_count INT DEFAULT 0,
  followup_sent TINYINT DEFAULT 0,
  item_id VARCHAR(255) NULL,
  model_code VARCHAR(100) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_session_state_account (account_id, state),
  INDEX idx_session_state_updated (updated_at)
) ENGINE=InnoDB;

-- Phase 04: Operation Safe Mode migration ledger.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255),
  checksum VARCHAR(128),
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  applied_by VARCHAR(128) NULL,
  status VARCHAR(32) DEFAULT 'applied'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Phase 04: Operation Safe Mode audit logs.
CREATE TABLE IF NOT EXISTS operation_audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  operation_id VARCHAR(64) NOT NULL,
  operation_type VARCHAR(128) NOT NULL,
  domain VARCHAR(64) NOT NULL,
  risk_level VARCHAR(32) NOT NULL,
  mode VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  actor_id VARCHAR(128) NULL,
  actor_role VARCHAR(64) NULL,
  actor_source VARCHAR(64) NULL,
  session_id VARCHAR(128) NULL,
  device_id VARCHAR(128) NULL,
  ip_address VARCHAR(64) NULL,
  target_type VARCHAR(64) NULL,
  target_id VARCHAR(128) NULL,
  client_request_id VARCHAR(128) NULL,
  idempotency_key_hash CHAR(64) NULL,
  confirm_token_id BIGINT NULL,
  payload_hash CHAR(64) NULL,
  impact_hash CHAR(64) NULL,
  payload_redacted_json JSON NULL,
  preview_response_json JSON NULL,
  before_snapshot_json JSON NULL,
  after_snapshot_json JSON NULL,
  external_request_redacted_json JSON NULL,
  external_response_redacted_json JSON NULL,
  error_code VARCHAR(128) NULL,
  error_message TEXT NULL,
  rollback_plan_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_operation_audit_logs_operation_id (operation_id),
  INDEX idx_operation_audit_logs_type_status_created (operation_type, status, created_at),
  INDEX idx_operation_audit_logs_actor_created (actor_id, created_at),
  INDEX idx_operation_audit_logs_target (target_type, target_id),
  INDEX idx_operation_audit_logs_idempotency (idempotency_key_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Phase 04: Operation Safe Mode confirm tokens.
CREATE TABLE IF NOT EXISTS operation_confirm_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  operation_type VARCHAR(128) NOT NULL,
  actor_id VARCHAR(128) NULL,
  actor_role VARCHAR(64) NULL,
  actor_source VARCHAR(64) NULL,
  payload_hash CHAR(64) NOT NULL,
  impact_hash CHAR(64) NOT NULL,
  preview_audit_log_id BIGINT NULL,
  idempotency_key_hash CHAR(64) NULL,
  status VARCHAR(32) DEFAULT 'issued',
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_operation_confirm_tokens_token_hash (token_hash),
  INDEX idx_operation_confirm_tokens_actor_operation_status (actor_id, operation_type, status),
  INDEX idx_operation_confirm_tokens_expires_at (expires_at),
  INDEX idx_operation_confirm_tokens_preview_audit (preview_audit_log_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Phase 04: Operation Safe Mode idempotency keys.
CREATE TABLE IF NOT EXISTS operation_idempotency_keys (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  key_hash CHAR(64) NOT NULL,
  actor_id VARCHAR(128) NULL,
  operation_type VARCHAR(128) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  audit_log_id BIGINT NULL,
  response_json JSON NULL,
  error_code VARCHAR(128) NULL,
  error_message TEXT NULL,
  locked_until TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_operation_idempotency_actor_type_key (actor_id, operation_type, key_hash),
  INDEX idx_operation_idempotency_status_lock (status, locked_until),
  INDEX idx_operation_idempotency_expires_at (expires_at),
  INDEX idx_operation_idempotency_audit_log (audit_log_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Phase 04: Operation Safe Mode rollback and compensation plans.
CREATE TABLE IF NOT EXISTS operation_rollback_plans (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  operation_id VARCHAR(64) NOT NULL,
  audit_log_id BIGINT NULL,
  operation_type VARCHAR(128) NOT NULL,
  target_type VARCHAR(64) NULL,
  target_id VARCHAR(128) NULL,
  rollback_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  before_snapshot_json JSON NULL,
  after_snapshot_json JSON NULL,
  forward_effects_json JSON NULL,
  compensation_steps_json JSON NULL,
  external_refs_json JSON NULL,
  requires_confirmation TINYINT(1) DEFAULT 1,
  confirm_token_id BIGINT NULL,
  executed_by VARCHAR(128) NULL,
  executed_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_operation_rollback_plans_operation_id (operation_id),
  INDEX idx_operation_rollback_plans_audit_log (audit_log_id),
  INDEX idx_operation_rollback_plans_type_status (operation_type, status),
  INDEX idx_operation_rollback_plans_target (target_type, target_id),
  INDEX idx_operation_rollback_plans_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
