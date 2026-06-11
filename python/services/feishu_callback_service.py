"""
feishu_callback_service.py — 飞书确认回调服务

在 faq_strict 模式下：
1. 知识库未命中 → 发默认回复 + 飞书通知 + 入 pending 队列
2. 功能性问题 → LLM web search → 飞书推送草稿 → 人工确认后回复
3. 人工在飞书卡片点击"确认发送"→ 回调到此服务 → 发送最终回复

也支持 Electron 端手动审批（feishu:pending:approve IPC）。
"""

import json
import pymysql
from mysql_helper import get_sqlite_like_connection
import threading
from contextlib import contextmanager
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any, Callable, Dict, Optional

from loguru import logger


class FeishuPendingReplyStore:
    """MySQL 存储的飞书待确认回复队列（与 Electron dbManager 共享同一 DB）。"""

    def __init__(self, db_path: str = None):
        self.db_path = db_path  # kept for compatibility

    @contextmanager
    def conn(self):
        c = get_sqlite_like_connection()
        try:
            yield c
            c.commit()
        finally:
            c.close()

    def create(self, payload: Dict[str, Any]) -> int:
        with self.conn() as c:
            c.execute(
                """
                INSERT INTO feishu_pending_replies (
                    session_id, item_id, model_code, user_question, ai_draft,
                    search_result, reply_type, status, feishu_message_id,
                    created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', %s, NOW(), NOW())
                """,
                (
                    payload.get("session_id"),
                    payload.get("item_id"),
                    payload.get("model_code"),
                    payload["user_question"],
                    payload.get("ai_draft"),
                    payload.get("search_result"),
                    payload.get("reply_type", "faq_miss"),
                    payload.get("feishu_message_id"),
                ),
            )
            return c.cursor().lastrowid

    def resolve(self, pending_id: int, final_reply: str, approved_by: str = "feishu") -> Optional[Dict]:
        with self.conn() as c:
            c.execute(
                """
                UPDATE feishu_pending_replies
                SET status='approved', final_reply=%s, approved_by=%s,
                    resolved_at=NOW(), updated_at=NOW()
                WHERE id=%s AND status='pending'
                """,
                (final_reply, approved_by, pending_id),
            )
            row = c.execute("SELECT * FROM feishu_pending_replies WHERE id=%s", (pending_id,)).fetchone()
            return dict(row) if row else None

    def get_pending(self, pending_id: int) -> Optional[Dict]:
        with self.conn() as c:
            row = c.execute("SELECT * FROM feishu_pending_replies WHERE id=%s", (pending_id,)).fetchone()
            return dict(row) if row else None

    def list_pending(self) -> list:
        with self.conn() as c:
            rows = c.execute(
                "SELECT * FROM feishu_pending_replies WHERE status='pending' ORDER BY created_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]


class FeishuCallbackHandler(BaseHTTPRequestHandler):
    """处理飞书卡片交互回调的 HTTP handler。"""

    store: FeishuPendingReplyStore = None
    on_approved: Callable = None  # callback(pending_record)

    def log_message(self, format, *args):
        logger.debug(f"[feishu-callback] {format % args}")

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        try:
            data = json.loads(body)
        except Exception:
            self._respond(400, {"error": "invalid json"})
            return

        # 飞书验证回调
        if data.get("type") == "url_verification":
            self._respond(200, {"challenge": data.get("challenge", "")})
            return

        # 卡片交互回调
        action = data.get("action", {})
        action_value = action.get("value", {})
        pending_id = action_value.get("pending_id")
        action_type = action_value.get("action_type")

        if not pending_id:
            self._respond(200, {"msg": "ignored"})
            return

        if action_type == "approve":
            final_reply = action_value.get("final_reply", "")
            record = self.store.resolve(int(pending_id), final_reply, "feishu")
            if record and self.on_approved:
                try:
                    self.on_approved(record)
                except Exception as e:
                    logger.error(f"[feishu-callback] 发送确认回复失败: {e}")
            self._respond(200, {"msg": "approved"})
        elif action_type == "reject":
            self._respond(200, {"msg": "rejected"})
        else:
            self._respond(200, {"msg": "unknown action"})

    def _respond(self, code: int, body: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())


class FeishuCallbackServer:
    """轻量 HTTP 服务器，监听飞书卡片回调。"""

    def __init__(
        self,
        store: FeishuPendingReplyStore,
        on_approved: Callable,
        port: int = 9876,
    ):
        self.store = store
        self.on_approved = on_approved
        self.port = port
        self._server: Optional[HTTPServer] = None
        self._thread: Optional[threading.Thread] = None

    def start(self):
        handler = type(
            "Handler",
            (FeishuCallbackHandler,),
            {"store": self.store, "on_approved": self.on_approved},
        )
        self._server = HTTPServer(("0.0.0.0", self.port), handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        logger.info(f"[feishu-callback] HTTP 服务已启动，端口 {self.port}")

    def stop(self):
        if self._server:
            self._server.shutdown()
            logger.info("[feishu-callback] HTTP 服务已停止")
