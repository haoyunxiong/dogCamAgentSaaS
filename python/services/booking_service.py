"""
BookingService · 建单草稿状态机（Sprint 5）

目的：当买家明确要下单或在 `quote_ready` 状态下确认后，推进一张
`booking_drafts` 草稿，直到生成 `rental_orders` 草稿行并通知人工确认。

本服务只改写 `booking_drafts`（以及在 commit 时写 `rental_orders`），
不发消息。是否把回复发出去由 ConversationProcessor 决定。

状态（简化版，先覆盖主干流程）：
    collecting              # 缺 model/dates/city，等待继续聊
    quote_ready             # QuoteService 已给出可租报价，等待买家确认
    order_drafted           # 买家已确认，订单草稿已入库，待人工最终确认
    closed                  # 取消 / 失败

调用方式：
    svc.on_booking_confirm_intent(session_id, item_id, buyer_id, item_description, slots, message)
        → 根据 slots 是否齐全返回 reply 或 followup
    svc.on_quote_available(session_id, item_id, buyer_id, slots, quote, reply_text)
        → 在 SCHEDULE_QUOTE 成功报价时登记，为后续 yes/no 做准备
    svc.handle_user_reply(session_id, message)
        → 若当前处于 quote_ready，根据确认 / 取消关键词返回 action
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from loguru import logger

STATE_COLLECTING = "collecting"
STATE_QUOTE_READY = "quote_ready"
STATE_ORDER_DRAFTED = "order_drafted"
STATE_CLOSED = "closed"

ACTIVE_STATES = (STATE_COLLECTING, STATE_QUOTE_READY)


DEFAULT_CONFIRM_KEYWORDS = [
    "好的", "好嘞", "好呀", "好", "行", "可以", "没问题", "OK", "ok", "Ok",
    "就这个", "就它了", "确认", "下单", "预定", "要了", "我要", "租了", "订了",
]

DEFAULT_CANCEL_KEYWORDS = [
    "不租了", "不租", "算了", "不要了", "不要", "先不", "再看看", "再想想",
    "取消", "不下单", "暂时不", "pass", "PASS",
]


DDL = """
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
) ENGINE=InnoDB
"""


@dataclass
class BookingConfig:
    enabled: bool = False
    confirm_keywords: List[str] = field(default_factory=lambda: list(DEFAULT_CONFIRM_KEYWORDS))
    cancel_keywords: List[str] = field(default_factory=lambda: list(DEFAULT_CANCEL_KEYWORDS))
    quote_ttl_min: int = 30  # quote_ready 超过该分钟数未回应则视作过期，不再接受 yes/no
    draft_notify_enabled: bool = True

    @classmethod
    def from_dict(cls, cfg: Optional[dict]) -> "BookingConfig":
        cfg = cfg or {}

        def _bool(key: str, default: bool) -> bool:
            raw = cfg.get(key, str(default))
            return str(raw).strip().lower() == "true"

        def _int(key: str, default: int) -> int:
            try:
                return int(cfg.get(key, default))
            except (TypeError, ValueError):
                return default

        def _keywords(key: str, default: List[str]) -> List[str]:
            raw = cfg.get(key)
            if not raw:
                return list(default)
            parts = [p.strip() for p in re.split(r"[,，]", str(raw)) if p.strip()]
            return parts or list(default)

        return cls(
            enabled=_bool("BOOKING_FSM_ENABLED", False),
            confirm_keywords=_keywords("BOOKING_CONFIRM_KEYWORDS", DEFAULT_CONFIRM_KEYWORDS),
            cancel_keywords=_keywords("BOOKING_CANCEL_KEYWORDS", DEFAULT_CANCEL_KEYWORDS),
            quote_ttl_min=_int("BOOKING_QUOTE_TTL_MIN", 30),
            draft_notify_enabled=_bool("BOOKING_DRAFT_NOTIFY_ENABLED", True),
        )


def _normalize(msg: str) -> str:
    return re.sub(r"\s+", "", (msg or "").strip().lower())


class BookingService:
    """建单草稿状态机。

    存储层：复用 rental_repository.conn() 直连 MySQL。
    以 session_id 为主键，每会话至多一条活跃草稿。
    """

    _table_ensured = False

    def __init__(
        self,
        *,
        rental_repository,
        config: Optional[dict] = None,
        schedule_service=None,
        notification_service=None,
    ):
        self.rental_repository = rental_repository
        self.schedule_service = schedule_service
        self.notification_service = notification_service
        self.config = BookingConfig.from_dict(config)

    @property
    def enabled(self) -> bool:
        return self.config.enabled and self.rental_repository is not None

    # ------------------------------------------------------------------
    # 底层存储
    # ------------------------------------------------------------------
    def _ensure_table(self, conn) -> None:
        if BookingService._table_ensured:
            return
        try:
            conn.execute(DDL)
            BookingService._table_ensured = True
        except Exception as e:
            logger.warning(f"[booking] booking_drafts 建表失败（稍后重试）: {e}")

    def get_draft(self, session_id: str) -> Optional[Dict[str, Any]]:
        if not session_id or not self.rental_repository:
            return None
        try:
            with self.rental_repository.conn() as conn:
                self._ensure_table(conn)
                row = conn.execute(
                    "SELECT * FROM booking_drafts WHERE session_id = %s",
                    (session_id,),
                ).fetchone()
                if not row:
                    return None
                row = dict(row)
                row["slots"] = _safe_json_loads(row.get("slots_json"), {})
                row["quote"] = _safe_json_loads(row.get("quote_json"), None)
                return row
        except Exception as e:
            logger.warning(f"[booking] get_draft 失败: {e}")
            return None

    def _upsert(
        self,
        *,
        session_id: str,
        item_id: Optional[str],
        model_code: Optional[str],
        buyer_id: Optional[str],
        state: str,
        slots: Dict[str, Any],
        quote: Optional[Dict[str, Any]] = None,
        last_user_message: Optional[str] = None,
        last_bot_message: Optional[str] = None,
        order_id: Optional[int] = None,
        closed_reason: Optional[str] = None,
    ) -> None:
        slots_json = json.dumps(slots, ensure_ascii=False)
        quote_json = json.dumps(quote, ensure_ascii=False) if quote is not None else None
        with self.rental_repository.conn() as conn:
            self._ensure_table(conn)
            conn.execute(
                """
                INSERT INTO booking_drafts (
                    session_id, item_id, model_code, buyer_id, state, slots_json, quote_json,
                    last_user_message, last_bot_message, order_id, closed_reason
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    item_id = COALESCE(VALUES(item_id), item_id),
                    model_code = COALESCE(VALUES(model_code), model_code),
                    buyer_id = COALESCE(VALUES(buyer_id), buyer_id),
                    state = VALUES(state),
                    slots_json = VALUES(slots_json),
                    quote_json = COALESCE(VALUES(quote_json), quote_json),
                    last_user_message = COALESCE(VALUES(last_user_message), last_user_message),
                    last_bot_message = COALESCE(VALUES(last_bot_message), last_bot_message),
                    order_id = COALESCE(VALUES(order_id), order_id),
                    closed_reason = VALUES(closed_reason),
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    session_id, item_id, model_code, buyer_id, state, slots_json, quote_json,
                    last_user_message, last_bot_message, order_id, closed_reason,
                ),
            )

    # ------------------------------------------------------------------
    # 对外接口
    # ------------------------------------------------------------------
    def on_booking_confirm_intent(
        self,
        *,
        session_id: str,
        item_id: Optional[str],
        buyer_id: Optional[str],
        slots: Optional[Dict[str, Any]],
        message: str,
    ) -> Dict[str, Any]:
        """IntentRouter 判定为 BOOKING_CONFIRM。

        返回 {"action": "reply"|"followup"|"noop", "reply_text": str, "state": str}
        目前 M4 版本：登记 collecting 草稿，缺信息时追问；完整信息等 QuoteService 给
        available 后再统一进 quote_ready。
        """
        if not self.enabled:
            return {"action": "noop"}

        slots = slots or {}
        existing = self.get_draft(session_id)

        # 已在 quote_ready → 可能是二次确认
        if existing and existing.get("state") == STATE_QUOTE_READY:
            reply = self._confirm_and_draft_order(existing, message)
            if reply:
                return reply

        merged_slots = dict((existing or {}).get("slots") or {})
        for k in ("model_code", "rent_start", "rent_end", "city", "shipping_mode"):
            v = slots.get(k)
            if v:
                merged_slots[k] = v

        state = STATE_COLLECTING
        model_code = merged_slots.get("model_code")

        self._upsert(
            session_id=session_id,
            item_id=item_id,
            model_code=model_code,
            buyer_id=buyer_id,
            state=state,
            slots=merged_slots,
            last_user_message=message,
        )

        missing = [k for k in ("model_code", "rent_start", "rent_end") if not merged_slots.get(k)]
        if missing:
            followup = self._build_followup(missing)
            return {"action": "followup", "reply_text": followup, "state": state, "missing": missing}

        # 所有必填齐了但尚未走过 QuoteService —— 让 ConversationProcessor 继续走 SCHEDULE_QUOTE
        return {"action": "noop", "state": state}

    def on_quote_available(
        self,
        *,
        session_id: str,
        item_id: Optional[str],
        buyer_id: Optional[str],
        slots: Dict[str, Any],
        quote: Dict[str, Any],
        reply_text: str,
    ) -> None:
        """QuoteService 返回 available 时登记草稿，进入 quote_ready。"""
        if not self.enabled:
            return
        try:
            self._upsert(
                session_id=session_id,
                item_id=item_id,
                model_code=slots.get("model_code"),
                buyer_id=buyer_id,
                state=STATE_QUOTE_READY,
                slots=dict(slots),
                quote=dict(quote),
                last_bot_message=reply_text,
            )
        except Exception as e:
            logger.warning(f"[booking] on_quote_available 写库失败: {e}")

    def handle_user_reply(
        self,
        *,
        session_id: str,
        message: str,
    ) -> Dict[str, Any]:
        """买家消息进来时，若当前在 quote_ready，判定确认 / 取消。

        返回:
            {"action": "confirm_ok" | "cancelled" | "expired" | "noop",
             "reply_text": str, "state": str, "draft": dict}
        """
        if not self.enabled:
            return {"action": "noop"}
        draft = self.get_draft(session_id)
        if not draft:
            return {"action": "noop"}
        state = draft.get("state")
        if state != STATE_QUOTE_READY:
            return {"action": "noop", "state": state}

        # TTL 校验
        updated_at = draft.get("updated_at")
        if self._is_expired(updated_at):
            self._upsert(
                session_id=session_id,
                item_id=draft.get("item_id"),
                model_code=draft.get("model_code"),
                buyer_id=draft.get("buyer_id"),
                state=STATE_CLOSED,
                slots=draft.get("slots") or {},
                quote=draft.get("quote"),
                last_user_message=message,
                closed_reason="quote_expired",
            )
            return {"action": "expired", "state": STATE_CLOSED, "draft": draft}

        msg = _normalize(message)
        if not msg:
            return {"action": "noop", "state": state}

        # 取消优先
        if any(_normalize(k) in msg for k in self.config.cancel_keywords):
            self._upsert(
                session_id=session_id,
                item_id=draft.get("item_id"),
                model_code=draft.get("model_code"),
                buyer_id=draft.get("buyer_id"),
                state=STATE_CLOSED,
                slots=draft.get("slots") or {},
                quote=draft.get("quote"),
                last_user_message=message,
                closed_reason="user_cancelled",
            )
            return {
                "action": "cancelled",
                "reply_text": "好的，有需要随时再找我~",
                "state": STATE_CLOSED,
                "draft": draft,
            }

        if any(_normalize(k) in msg for k in self.config.confirm_keywords):
            return self._confirm_and_draft_order(draft, message) or {"action": "noop"}

        return {"action": "noop", "state": state}

    # ------------------------------------------------------------------
    # 内部：下单草稿
    # ------------------------------------------------------------------
    def _confirm_and_draft_order(
        self,
        draft: Dict[str, Any],
        message: str,
    ) -> Optional[Dict[str, Any]]:
        slots = draft.get("slots") or {}
        quote = draft.get("quote") or {}
        model_code = draft.get("model_code") or slots.get("model_code")
        rent_start = slots.get("rent_start")
        rent_end = slots.get("rent_end")
        city = slots.get("city")
        shipping_mode = slots.get("shipping_mode") or "sf"
        fee = float(quote.get("total") or 0)
        deposit = float(quote.get("deposit") or 0)

        # 防御：缺关键信息不生成订单草稿，仍走人工
        if not (model_code and rent_start and rent_end):
            self._upsert(
                session_id=draft["session_id"],
                item_id=draft.get("item_id"),
                model_code=model_code,
                buyer_id=draft.get("buyer_id"),
                state=STATE_CLOSED,
                slots=slots,
                quote=quote,
                last_user_message=message,
                closed_reason="confirm_missing_slots",
            )
            return {
                "action": "noop",
                "reply_text": "",
                "state": STATE_CLOSED,
            }

        order_id: Optional[int] = None
        try:
            order_id = self.rental_repository.create_order({
                "session_id": draft.get("session_id"),
                "model_code": model_code,
                "rent_start_date": rent_start,
                "rent_end_date": rent_end,
                "city": city,
                "address": slots.get("address"),
                "customer_name": slots.get("customer_name"),
                "customer_phone": slots.get("customer_phone"),
                "fee": fee,
                "deposit": deposit,
                "shipping_mode": shipping_mode,
                "order_status": "draft",
            })
        except Exception as e:
            logger.warning(f"[booking] create_order 失败: {e}")

        self._upsert(
            session_id=draft["session_id"],
            item_id=draft.get("item_id"),
            model_code=model_code,
            buyer_id=draft.get("buyer_id"),
            state=STATE_ORDER_DRAFTED,
            slots=slots,
            quote=quote,
            last_user_message=message,
            order_id=order_id,
        )

        # 可选通知（飞书 / 控制台）
        if self.config.draft_notify_enabled and self.notification_service is not None:
            try:
                rent_range = f"{rent_start} ~ {rent_end}"
                self.notification_service.notify_order({
                    "type": "booking_drafted",
                    "orderId": order_id,
                    "modelCode": model_code,
                    "rentRange": rent_range,
                    "fee": fee,
                    "deposit": deposit,
                    "shippingMode": shipping_mode,
                    "address": city or slots.get("address"),
                })
            except Exception as e:
                logger.debug(f"[booking] notify 失败（忽略）: {e}")

        reply_text = (
            f"好嘞，已帮您预记订单：{model_code} {rent_start}~{rent_end}"
            f"（共 {fee:.0f} 元"
            + (f"，押金 {deposit:.0f} 元" if deposit else "")
            + "）。稍后人工会再跟您核对收货地址和发货时间哈~"
        )
        return {
            "action": "confirm_ok",
            "reply_text": reply_text,
            "state": STATE_ORDER_DRAFTED,
            "order_id": order_id,
            "draft": draft,
        }

    # ------------------------------------------------------------------
    # 工具
    # ------------------------------------------------------------------
    def _build_followup(self, missing: List[str]) -> str:
        if "rent_start" in missing or "rent_end" in missing:
            if "model_code" in missing:
                return "收到~麻烦再确认下您要租哪一款、租期大概是哪几天，我这边马上给您查档期和报价。"
            return "好的~请告诉我具体租期（例如 5月1日到5月4日），我帮您查档期和总价。"
        if "model_code" in missing:
            return "收到~麻烦发下您要租的具体型号（或商品链接），我给您确认档期。"
        return "好的，稍等我核对下~"

    def _is_expired(self, updated_at) -> bool:
        if not self.config.quote_ttl_min or self.config.quote_ttl_min <= 0:
            return False
        dt = _coerce_datetime(updated_at)
        if dt is None:
            return False
        return datetime.now() - dt > timedelta(minutes=self.config.quote_ttl_min)


# ---------------------------------------------------------------------------
def _safe_json_loads(value, default):
    if value is None or value == "":
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def _coerce_datetime(v) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    s = str(v).replace("T", " ").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None
