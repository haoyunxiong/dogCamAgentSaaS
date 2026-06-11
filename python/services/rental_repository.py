import json
import sqlite3  # kept for chat_db
import pymysql
from mysql_helper import get_sqlite_like_connection
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional


class RentalRepository:
    def __init__(self, app_db_path: str, chat_db_path: Optional[str] = None):
        self.app_db_path = app_db_path
        self.chat_db_path = chat_db_path

    @contextmanager
    def conn(self):
        conn = get_sqlite_like_connection()
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def get_config(self, key: str, default: str = "") -> str:
        with self.conn() as conn:
            row = conn.execute("SELECT value FROM config WHERE `key` = %s", (key,)).fetchone()
            return row["value"] if row else default

    def list_configs(self) -> Dict[str, str]:
        with self.conn() as conn:
            rows = conn.execute("SELECT `key`, `value` FROM config").fetchall()
            return {row["key"]: row["value"] for row in rows}

    def create_takeover_task(
        self,
        session_id: str,
        item_id: Optional[str],
        model_code: Optional[str],
        latest_question: str,
        reason: str,
        priority: str = "normal",
    ) -> int:
        with self.conn() as conn:
            existing = conn.execute(
                """
                SELECT id FROM takeover_tasks
                WHERE session_id = %s AND status IN ('new','notified','accepted','timeout','escalated')
                ORDER BY id DESC LIMIT 1
                """,
                (session_id,),
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE takeover_tasks
                    SET latest_question = %s, reason = %s, priority = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (latest_question, reason, priority, existing["id"]),
                )
                return existing["id"]

            cursor = conn.execute(
                """
                INSERT INTO takeover_tasks (
                    session_id, item_id, model_code, latest_question, reason, priority, status, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, 'new', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (session_id, item_id, model_code, latest_question, reason, priority),
            )
            return cursor.lastrowid

    def get_takeover_task(self, task_id: int) -> Optional[Dict[str, Any]]:
        with self.conn() as conn:
            row = conn.execute("SELECT * FROM takeover_tasks WHERE id = %s", (task_id,)).fetchone()
            return dict(row) if row else None

    def list_pending_takeovers(self) -> List[Dict[str, Any]]:
        with self.conn() as conn:
            rows = conn.execute(
                "SELECT * FROM takeover_tasks WHERE status IN ('new','notified','timeout') ORDER BY id ASC"
            ).fetchall()
            return [dict(row) for row in rows]

    def mark_takeover_notified(self, task_id: int):
        with self.conn() as conn:
            conn.execute(
                """
                UPDATE takeover_tasks
                SET status = 'notified', notified_at = COALESCE(notified_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (task_id,),
            )

    def mark_takeover_escalated(self, task_id: int):
        with self.conn() as conn:
            conn.execute(
                """
                UPDATE takeover_tasks
                SET status = 'escalated', escalated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (task_id,),
            )

    def create_learning_candidate(
        self,
        session_id: Optional[str],
        item_id: Optional[str],
        model_code: Optional[str],
        question: str,
        final_answer: str,
        candidate_scope: str = "global",
        tags: Optional[Iterable[str]] = None,
        source_message_ids: Optional[List[int]] = None,
    ) -> int:
        tag_payload = json.dumps(list(tags or []), ensure_ascii=False)
        message_payload = json.dumps(source_message_ids or [], ensure_ascii=False)
        with self.conn() as conn:
            duplicate = conn.execute(
                """
                SELECT id FROM learning_candidates
                WHERE session_id <=> %s AND question = %s AND final_answer = %s
                ORDER BY id DESC LIMIT 1
                """,
                (session_id, question, final_answer),
            ).fetchone()
            if duplicate:
                return duplicate["id"]
            cursor = conn.execute(
                """
                INSERT INTO learning_candidates (
                    session_id, item_id, model_code, question, final_answer, source_message_ids,
                    candidate_scope, tags, review_status, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pending', CURRENT_TIMESTAMP)
                """,
                (session_id, item_id, model_code, question, final_answer, message_payload, candidate_scope, tag_payload),
            )
            return cursor.lastrowid

    def list_units_by_model(self, model_code: str) -> List[Dict[str, Any]]:
        with self.conn() as conn:
            rows = conn.execute(
                "SELECT * FROM schedule_units WHERE model_code = %s AND status != 'offline' ORDER BY unit_code ASC",
                (model_code,),
            ).fetchall()
            return [dict(row) for row in rows]

    def list_overlapping_blocks(self, model_code: str, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        with self.conn() as conn:
            rows = conn.execute(
                """
                SELECT * FROM schedule_blocks
                WHERE model_code = %s AND status = 'active'
                  AND NOT (end_date < %s OR start_date > %s)
                ORDER BY start_date ASC
                """,
                (model_code, start_date, end_date),
            ).fetchall()
            return [dict(row) for row in rows]

    def create_order(self, payload: Dict[str, Any]) -> int:
        with self.conn() as conn:
            cursor = conn.execute(
                """
                INSERT INTO rental_orders (
                    session_id, order_no, model_code, unit_id, customer_name, customer_phone,
                    city, district, address, rent_start_date, rent_end_date, fee, deposit,
                    order_status, planned_ship_at, expected_arrive_at, tracking_no,
                    shipping_mode, latest_logistics_status, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (
                    payload.get("session_id"),
                    payload.get("order_no"),
                    payload.get("model_code"),
                    payload.get("unit_id"),
                    payload.get("customer_name"),
                    payload.get("customer_phone"),
                    payload.get("city"),
                    payload.get("district"),
                    payload.get("address"),
                    payload.get("rent_start_date"),
                    payload.get("rent_end_date"),
                    payload.get("fee", 0),
                    payload.get("deposit", 0),
                    payload.get("order_status", "waiting_payment"),
                    payload.get("planned_ship_at"),
                    payload.get("expected_arrive_at"),
                    payload.get("tracking_no"),
                    payload.get("shipping_mode"),
                    payload.get("latest_logistics_status"),
                ),
            )
            return cursor.lastrowid

    def create_schedule_block(self, payload: Dict[str, Any]) -> int:
        with self.conn() as conn:
            cursor = conn.execute(
                """
                INSERT INTO schedule_blocks (
                    unit_id, order_id, model_code, block_type, start_date, end_date,
                    planned_ship_at, expected_arrive_at, status, note, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (
                    payload.get("unit_id"),
                    payload.get("order_id"),
                    payload.get("model_code"),
                    payload.get("block_type"),
                    payload.get("start_date"),
                    payload.get("end_date"),
                    payload.get("planned_ship_at"),
                    payload.get("expected_arrive_at"),
                    payload.get("status", "active"),
                    payload.get("note"),
                ),
            )
            return cursor.lastrowid

    def create_shipping_record(self, payload: Dict[str, Any]) -> int:
        with self.conn() as conn:
            cursor = conn.execute(
                """
                INSERT INTO shipping_records (
                    order_id, carrier, tracking_no, shipping_mode, latest_status,
                    ship_from_city, ship_to_city, planned_ship_at, actual_ship_at,
                    expected_arrive_at, actual_arrive_at, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (
                    payload.get("order_id"),
                    payload.get("carrier", "sf"),
                    payload.get("tracking_no"),
                    payload.get("shipping_mode"),
                    payload.get("latest_status"),
                    payload.get("ship_from_city"),
                    payload.get("ship_to_city"),
                    payload.get("planned_ship_at"),
                    payload.get("actual_ship_at"),
                    payload.get("expected_arrive_at"),
                    payload.get("actual_arrive_at"),
                ),
            )
            return cursor.lastrowid

    def find_recent_session_messages(self, chat_id: str, limit: int = 6) -> List[Dict[str, Any]]:
        if not self.chat_db_path:
            return []
        conn = sqlite3.connect(self.chat_db_path)
        conn.row_factory = sqlite3.Row
        try:
            rows = conn.execute(
                "SELECT id, role, content, item_id, chat_id, timestamp FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?",
                (chat_id, limit),
            ).fetchall()
            return [dict(row) for row in reversed(rows)]
        finally:
            conn.close()

    def scan_chat_pairs(self) -> List[Dict[str, Any]]:
        if not self.chat_db_path:
            return []
        conn = sqlite3.connect(self.chat_db_path)
        conn.row_factory = sqlite3.Row
        try:
            rows = conn.execute(
                "SELECT id, chat_id, item_id, role, content, timestamp FROM messages ORDER BY chat_id ASC, id ASC"
            ).fetchall()
        finally:
            conn.close()
        return [dict(row) for row in rows]

    def get_item_descriptions(self) -> Dict[str, str]:
        with self.conn() as conn:
            rows = conn.execute("SELECT item_id, description FROM item_cache").fetchall()
            return {row["item_id"]: row["description"] or "" for row in rows}

    def update_order_shipping(self, order_id: int, tracking_no: Optional[str], shipping_mode: Optional[str], latest_status: Optional[str]):
        with self.conn() as conn:
            conn.execute(
                """
                UPDATE rental_orders
                SET tracking_no = ?, shipping_mode = ?, latest_logistics_status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (tracking_no, shipping_mode, latest_status, order_id),
            )

    @staticmethod
    def iso_now() -> str:
        return datetime.now().isoformat(timespec="seconds")

    # ────────────────── session_reply_state ──────────────────
    def get_session_state(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self.conn() as conn:
            row = conn.execute(
                "SELECT * FROM session_reply_state WHERE session_id = %s",
                (session_id,),
            ).fetchone()
            return dict(row) if row else None

    def upsert_session_state(self, session_id: str, fields: Dict[str, Any]) -> None:
        """部分字段 upsert（仅写入提供的字段，其他保持不变）。"""
        if not fields:
            return
        allowed = {
            "account_id", "state", "cooldown_since", "last_notify_at",
            "last_human_msg_at", "last_buyer_msg_at", "last_default_reply_at",
            "default_reply_count", "followup_sent", "item_id", "model_code",
        }
        payload = {k: v for k, v in fields.items() if k in allowed}
        if not payload:
            return
        cols = ["session_id"] + list(payload.keys())
        placeholders = ", ".join(["%s"] * len(cols))
        update_clause = ", ".join([f"`{k}` = VALUES(`{k}`)" for k in payload.keys()])
        sql = (
            f"INSERT INTO session_reply_state ({', '.join(f'`{c}`' for c in cols)}) "
            f"VALUES ({placeholders}) "
            f"ON DUPLICATE KEY UPDATE {update_clause}"
        )
        values = [session_id] + [payload[k] for k in payload.keys()]
        with self.conn() as conn:
            conn.execute(sql, tuple(values))

    def reset_session_state(self, session_id: str) -> None:
        with self.conn() as conn:
            conn.execute(
                """
                UPDATE session_reply_state
                SET state = 'auto',
                    cooldown_since = NULL,
                    last_notify_at = NULL,
                    followup_sent = 0,
                    default_reply_count = 0
                WHERE session_id = %s
                """,
                (session_id,),
            )

    def list_session_states(self, only_non_auto: bool = False) -> List[Dict[str, Any]]:
        with self.conn() as conn:
            sql = "SELECT * FROM session_reply_state"
            if only_non_auto:
                sql += " WHERE state <> 'auto'"
            sql += " ORDER BY updated_at DESC LIMIT 500"
            rows = conn.execute(sql).fetchall()
            return [dict(row) for row in rows]

        # ------------------------------------------------------------------
        # Sprint 2+: item_id ↔ biz_item_code ↔ model_code 显式映射
        # ------------------------------------------------------------------
    _ITEM_MODEL_MAPPING_DDL = """
        CREATE TABLE IF NOT EXISTS item_model_mapping (
          item_id VARCHAR(255) PRIMARY KEY,
                    model_code VARCHAR(100),
                    biz_item_code VARCHAR(100),
          source VARCHAR(32) NOT NULL DEFAULT 'manual',
          note VARCHAR(255),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_item_model_mapping_model (model_code),
                    INDEX idx_item_model_mapping_biz (biz_item_code)
        ) ENGINE=InnoDB
    """

    _item_model_mapping_ensured = False

    def _ensure_item_model_mapping(self, conn) -> None:
        if RentalRepository._item_model_mapping_ensured:
            return
        try:
            conn.execute(self._ITEM_MODEL_MAPPING_DDL)
            columns = conn.execute("SHOW COLUMNS FROM item_model_mapping").fetchall()
            column_names = {row.get("Field") for row in columns if isinstance(row, dict)}
            if "biz_item_code" not in column_names:
                conn.execute(
                    "ALTER TABLE item_model_mapping ADD COLUMN biz_item_code VARCHAR(100) NULL AFTER model_code"
                )
            try:
                conn.execute(
                    "ALTER TABLE item_model_mapping MODIFY COLUMN model_code VARCHAR(100) NULL"
                )
            except Exception:
                pass
            try:
                conn.execute(
                    "CREATE INDEX idx_item_model_mapping_biz ON item_model_mapping (biz_item_code)"
                )
            except Exception:
                pass
            RentalRepository._item_model_mapping_ensured = True
        except Exception:
            # 单次建表失败不抛，下次调用自然重试
            pass

    def get_item_mapping_by_item_id(self, item_id: Optional[str]) -> Optional[Dict[str, Any]]:
        if not item_id:
            return None
        try:
            with self.conn() as conn:
                self._ensure_item_model_mapping(conn)
                row = conn.execute(
                    "SELECT * FROM item_model_mapping WHERE item_id = %s",
                    (item_id,),
                ).fetchone()
                return dict(row) if row else None
        except Exception:
            return None

    def get_model_by_item_id(self, item_id: Optional[str]) -> Optional[str]:
        row = self.get_item_mapping_by_item_id(item_id)
        return row.get("model_code") if row else None

    def get_biz_item_code_by_item_id(self, item_id: Optional[str]) -> Optional[str]:
        row = self.get_item_mapping_by_item_id(item_id)
        return row.get("biz_item_code") if row else None

    def upsert_item_model_mapping(
        self,
        item_id: str,
        model_code: Optional[str] = None,
        biz_item_code: Optional[str] = None,
        source: str = "manual",
        note: Optional[str] = None,
    ) -> None:
        if not item_id:
            return
        normalized_model_code = (model_code or "").strip() or None
        normalized_biz_item_code = (biz_item_code or "").strip() or None
        with self.conn() as conn:
            self._ensure_item_model_mapping(conn)
            existing = conn.execute(
                "SELECT model_code, biz_item_code, source, note FROM item_model_mapping WHERE item_id = %s",
                (item_id,),
            ).fetchone()
            resolved_model_code = normalized_model_code
            resolved_biz_item_code = normalized_biz_item_code
            resolved_source = source
            resolved_note = note

            if existing:
                if resolved_model_code is None:
                    resolved_model_code = existing.get("model_code")
                if resolved_biz_item_code is None:
                    resolved_biz_item_code = existing.get("biz_item_code")
                if resolved_note is None:
                    resolved_note = existing.get("note")
                if existing.get("source") == "manual" and source != "manual":
                    resolved_source = existing.get("source") or source

            if not resolved_model_code and not resolved_biz_item_code:
                return

            conn.execute(
                """
                INSERT INTO item_model_mapping (item_id, model_code, biz_item_code, source, note)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    model_code = VALUES(model_code),
                    biz_item_code = VALUES(biz_item_code),
                    source = VALUES(source),
                    note = VALUES(note),
                    updated_at = CURRENT_TIMESTAMP
                """,
                (item_id, resolved_model_code, resolved_biz_item_code, resolved_source, resolved_note),
            )

    def list_item_model_mappings(self) -> List[Dict[str, Any]]:
        try:
            with self.conn() as conn:
                self._ensure_item_model_mapping(conn)
                rows = conn.execute(
                    "SELECT * FROM item_model_mapping ORDER BY updated_at DESC"
                ).fetchall()
                return [dict(row) for row in rows]
        except Exception:
            return []

    def delete_item_model_mapping(self, item_id: str) -> None:
        with self.conn() as conn:
            self._ensure_item_model_mapping(conn)
            conn.execute("DELETE FROM item_model_mapping WHERE item_id = %s", (item_id,))

    # ------------------------------------------------------------------
    # Sprint 6: 结构化学习建议（不进知识库，供人工审阅）
    # ------------------------------------------------------------------
    _STRUCTURED_LEARNING_DDL = """
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
        ) ENGINE=InnoDB
    """

    _structured_learning_ensured = False

    def _ensure_structured_learning(self, conn) -> None:
        if RentalRepository._structured_learning_ensured:
            return
        try:
            conn.execute(self._STRUCTURED_LEARNING_DDL)
            RentalRepository._structured_learning_ensured = True
        except Exception:
            pass

    def create_structured_learning_suggestion(
        self,
        *,
        session_id: Optional[str],
        item_id: Optional[str],
        model_code: Optional[str],
        category: str,
        user_message: Optional[str],
        bot_or_human_reply: Optional[str],
        suggested_slot: Optional[Dict[str, Any]] = None,
        note: Optional[str] = None,
    ) -> int:
        slot_json = json.dumps(suggested_slot or {}, ensure_ascii=False)
        with self.conn() as conn:
            self._ensure_structured_learning(conn)
            # 同一 session + question + answer 去重，避免重复入库
            dup = conn.execute(
                """
                SELECT id FROM structured_learning_suggestions
                WHERE source_session_id <=> %s
                  AND user_message <=> %s
                  AND bot_or_human_reply <=> %s
                  AND category = %s
                ORDER BY id DESC LIMIT 1
                """,
                (session_id, user_message, bot_or_human_reply, category),
            ).fetchone()
            if dup:
                return dup["id"]
            cursor = conn.execute(
                """
                INSERT INTO structured_learning_suggestions (
                    source_session_id, item_id, model_code, category,
                    user_message, bot_or_human_reply, suggested_slot_json, note
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    session_id, item_id, model_code, category,
                    user_message, bot_or_human_reply, slot_json, note,
                ),
            )
            return cursor.lastrowid

    def list_structured_learning_suggestions(
        self,
        *,
        category: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 200,
    ) -> List[Dict[str, Any]]:
        try:
            with self.conn() as conn:
                self._ensure_structured_learning(conn)
                where = []
                params: List[Any] = []
                if category:
                    where.append("category = %s")
                    params.append(category)
                if status:
                    where.append("status = %s")
                    params.append(status)
                where_sql = f"WHERE {' AND '.join(where)}" if where else ""
                sql = (
                    "SELECT * FROM structured_learning_suggestions "
                    f"{where_sql} ORDER BY id DESC LIMIT %s"
                )
                params.append(int(limit))
                rows = conn.execute(sql, tuple(params)).fetchall()
                return [dict(row) for row in rows]
        except Exception:
            return []

    def update_structured_learning_status(self, suggestion_id: int, status: str) -> None:
        with self.conn() as conn:
            self._ensure_structured_learning(conn)
            conn.execute(
                "UPDATE structured_learning_suggestions SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                (status, suggestion_id),
            )

    # ------------------------------------------------------------------
    # Sprint 6+: 历史去重辅助 —— 拉取已存在候选的 (question, answer) 摘要
    # ------------------------------------------------------------------
    def list_learning_candidate_pairs(self) -> List[Dict[str, str]]:
        """返回 learning_candidates 中全部 (question, final_answer) 列表（供内存去重）。"""
        try:
            with self.conn() as conn:
                rows = conn.execute(
                    "SELECT question, final_answer FROM learning_candidates"
                ).fetchall()
                return [
                    {"question": r["question"] or "", "answer": r["final_answer"] or ""}
                    for r in rows
                ]
        except Exception:
            return []

    def list_structured_suggestion_pairs(self) -> List[Dict[str, str]]:
        """返回 structured_learning_suggestions 中全部 (user_message, bot_or_human_reply)。"""
        try:
            with self.conn() as conn:
                self._ensure_structured_learning(conn)
                rows = conn.execute(
                    "SELECT user_message, bot_or_human_reply FROM structured_learning_suggestions"
                ).fetchall()
                return [
                    {
                        "question": r["user_message"] or "",
                        "answer": r["bot_or_human_reply"] or "",
                    }
                    for r in rows
                ]
        except Exception:
            return []
