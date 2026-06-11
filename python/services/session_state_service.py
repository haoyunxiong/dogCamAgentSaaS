"""会话回复状态机（Phase 1）。

状态定义：
    auto          默认，走正常自动回复流程
    cooldown      刚发过默认回复，COOLDOWN_MIN 内对新的买家消息保持静默；
                  通知节流（每 NOTIFY_THROTTLE_MIN 分钟最多一次）；
                  冷却超过 TAKEOVER_FOLLOWUP_MIN 且买家再次催问 → 发一次 followup
    human_active  检测到人工回复（来自 闲管家/网页/插件），HUMAN_IDLE_MIN 内静默
    manual        显式接管（toggle keyword），手动恢复前一直静默

本服务只负责状态读写/超时推导/节流判定，不直接发消息。
真正的静默/发送/通知动作由 ConversationProcessor 和 BrowserRunner 执行。
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Optional

from loguru import logger

from .rental_repository import RentalRepository


STATE_AUTO = "auto"
STATE_COOLDOWN = "cooldown"
STATE_HUMAN = "human_active"
STATE_MANUAL = "manual"

_BOT_SIG_RETAIN_SEC = 24 * 60 * 60  # 24h


@dataclass
class SessionStateConfig:
    enabled: bool = True
    cooldown_min: int = 10
    notify_throttle_min: int = 3
    human_idle_min: int = 15
    followup_enabled: bool = True
    followup_min: int = 5
    followup_text: str = "不好意思让您久等了，我这边处理完马上回复您哈"

    @classmethod
    def from_dict(cls, cfg: Optional[dict]) -> "SessionStateConfig":
        cfg = cfg or {}

        def _int(key: str, default: int) -> int:
            try:
                return int(cfg.get(key, default))
            except (TypeError, ValueError):
                return default

        def _bool(key: str, default: bool) -> bool:
            raw = cfg.get(key, str(default))
            return str(raw).strip().lower() == "true"

        return cls(
            enabled=_bool("SESSION_STATE_ENABLED", True),
            cooldown_min=_int("COOLDOWN_MIN", 10),
            notify_throttle_min=_int("NOTIFY_THROTTLE_MIN", 3),
            human_idle_min=_int("HUMAN_IDLE_MIN", 15),
            followup_enabled=_bool("TAKEOVER_FOLLOWUP_ENABLED", True),
            followup_min=_int("TAKEOVER_FOLLOWUP_MIN", 5),
            followup_text=str(cfg.get("TAKEOVER_FOLLOWUP_TEXT", cls.followup_text)),
        )


def _parse_dt(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).replace("T", " ").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


class SessionStateService:
    def __init__(self, repository: RentalRepository, config: Optional[dict] = None):
        self.repository = repository
        self.config = SessionStateConfig.from_dict(config)
        # session_id -> {signature -> ts}
        self._bot_sent_signatures: Dict[str, Dict[str, float]] = {}

    # ── public config access ──
    def reload_config(self, cfg: dict) -> None:
        self.config = SessionStateConfig.from_dict(cfg)

    @property
    def enabled(self) -> bool:
        return self.config.enabled

    # ── bot-sent signatures (long retention, to distinguish human vs bot outgoing) ──
    def mark_bot_sent(self, session_id: str, text: str) -> None:
        if not session_id or not text:
            return
        session_id = self._state_key(session_id)
        sig = self._normalize_sig(text)
        now = time.time()
        bucket = self._bot_sent_signatures.setdefault(session_id, {})
        bucket[sig] = now
        self._gc_bot_signatures(now)

    def is_bot_outgoing(self, session_id: str, text: str) -> bool:
        if not session_id or not text:
            return False
        session_id = self._state_key(session_id)
        self._gc_bot_signatures(time.time())
        bucket = self._bot_sent_signatures.get(session_id) or {}
        return self._normalize_sig(text) in bucket

    def _gc_bot_signatures(self, now: float) -> None:
        cutoff = now - _BOT_SIG_RETAIN_SEC
        empty_sessions = []
        for sid, bucket in list(self._bot_sent_signatures.items()):
            expired = [sig for sig, ts in bucket.items() if ts < cutoff]
            for sig in expired:
                bucket.pop(sig, None)
            if not bucket:
                empty_sessions.append(sid)
        for sid in empty_sessions:
            self._bot_sent_signatures.pop(sid, None)

    # 跨渲染形态的会话键归一化：浏览器侧同一会话在未读角标存在 / 清空时会产生
    # `browser-session:<itemId>:<未读数>` 与 `browser-session:<itemId>:<昵称>` 两种 id；
    # 这里把末尾一段（最后一个冒号之后的部分）一律剥离，使两种形式映射到同一 DB 行。
    # 标准格式 `browser-session:<item_id>:<sender>` 去掉 sender 后仍唯一标识 (seller, item)
    # 这一 IM 会话。注意：该归一化 **只** 用于 state machine 自身的 DB key 与内存字典查询，
    # 不影响 browser_runner 发送消息时对页面 DOM 的定位（DOM 仍用原始 session_id）。
    @staticmethod
    def _state_key(session_id: str) -> str:
        if not session_id:
            return session_id
        # 仅处理 browser-session: 前缀的浏览器会话 id；其他渠道（如 API 模式）保持原样
        if not session_id.startswith("browser-session:"):
            return session_id
        idx = session_id.rfind(":")
        if idx <= len("browser-session"):  # 没有额外分段，保持原样
            return session_id
        return session_id[:idx]

    @staticmethod
    def _normalize_sig(text: str) -> str:
        s = (text or "").strip().replace(" ", "").replace("\u00a0", "")
        # 剥离页面渲染的消息状态后缀/前缀（闲鱼 Web IM 会把 "未读/已读/已撤回" 拼在气泡文本里）
        for suffix in ("未读", "已读", "已撤回", "撤回", "刚刚"):
            while s.endswith(suffix):
                s = s[: -len(suffix)]
            while s.startswith(suffix):
                s = s[len(suffix):]
        return s

    # ── state read (with timeout decay) ──
    def read_state(self, session_id: str) -> Dict:
        """读取状态，自动应用超时降级。返回包含 state/row/config 的字典。"""
        session_id = self._state_key(session_id)
        row = self.repository.get_session_state(session_id) or {}
        state = row.get("state") or STATE_AUTO
        now = datetime.now()

        if state == STATE_COOLDOWN:
            since = _parse_dt(row.get("cooldown_since"))
            if since and now - since >= timedelta(minutes=self.config.cooldown_min):
                self.repository.reset_session_state(session_id)
                state = STATE_AUTO
                logger.info(f"[session-state] {session_id} cooldown 超时，恢复 auto")
        elif state == STATE_HUMAN:
            last_human = _parse_dt(row.get("last_human_msg_at"))
            if last_human and now - last_human >= timedelta(minutes=self.config.human_idle_min):
                self.repository.reset_session_state(session_id)
                state = STATE_AUTO
                logger.info(f"[session-state] {session_id} human_active 超时，恢复 auto")
        # manual 状态不自动降级
        return {"state": state, "row": row, "now": now}

    # ── transitions ──
    def on_buyer_message(self, session_id: str, item_id: Optional[str] = None) -> None:
        """记录买家消息时间。"""
        session_id = self._state_key(session_id)
        self.repository.upsert_session_state(session_id, {
            "last_buyer_msg_at": datetime.now(),
            **({"item_id": item_id} if item_id else {}),
        })

    def on_default_reply_sent(self, session_id: str, item_id: Optional[str] = None, model_code: Optional[str] = None) -> None:
        """发出默认回复后调用：进入 cooldown。"""
        session_id = self._state_key(session_id)
        now = datetime.now()
        current = self.repository.get_session_state(session_id) or {}
        cnt = int(current.get("default_reply_count") or 0) + 1
        self.repository.upsert_session_state(session_id, {
            "state": STATE_COOLDOWN,
            "cooldown_since": now,
            "last_default_reply_at": now,
            "last_notify_at": now,  # 视作刚刚通知过，从此刻起计节流
            "default_reply_count": cnt,
            "followup_sent": 0,
            **({"item_id": item_id} if item_id else {}),
            **({"model_code": model_code} if model_code else {}),
        })
        logger.info(f"[session-state] {session_id} → cooldown (第 {cnt} 次默认回复)")

    def on_human_outgoing(self, session_id: str) -> None:
        """检测到人工回复（非机器人发出）：进入 human_active。"""
        session_id = self._state_key(session_id)
        now = datetime.now()
        self.repository.upsert_session_state(session_id, {
            "state": STATE_HUMAN,
            "last_human_msg_at": now,
            "followup_sent": 0,
        })
        logger.info(f"[session-state] {session_id} → human_active（检测到人工回复）")

    def on_manual_toggle(self, session_id: str, enable: bool) -> None:
        session_id = self._state_key(session_id)
        if enable:
            self.repository.upsert_session_state(session_id, {"state": STATE_MANUAL})
            logger.info(f"[session-state] {session_id} → manual（显式接管）")
        else:
            self.repository.reset_session_state(session_id)
            logger.info(f"[session-state] {session_id} → auto（恢复自动）")

    def on_feishu_approved(self, session_id: str) -> None:
        """飞书审批通过后恢复 auto。"""
        session_id = self._state_key(session_id)
        self.repository.reset_session_state(session_id)
        logger.info(f"[session-state] {session_id} → auto（飞书审批通过）")

    def mark_followup_sent(self, session_id: str) -> None:
        session_id = self._state_key(session_id)
        self.repository.upsert_session_state(session_id, {"followup_sent": 1})

    def mark_notify(self, session_id: str) -> None:
        session_id = self._state_key(session_id)
        self.repository.upsert_session_state(session_id, {"last_notify_at": datetime.now()})

    # ── decision helpers ──
    def should_throttle_notify(self, row: dict, now: datetime) -> bool:
        last = _parse_dt(row.get("last_notify_at"))
        if not last:
            return False
        return (now - last) < timedelta(minutes=self.config.notify_throttle_min)

    def should_send_followup(self, row: dict, now: datetime) -> bool:
        if not self.config.followup_enabled:
            return False
        if int(row.get("followup_sent") or 0) == 1:
            return False
        since = _parse_dt(row.get("cooldown_since"))
        if not since:
            return False
        return (now - since) >= timedelta(minutes=self.config.followup_min)

    def force_reset(self, session_id: str) -> None:
        """供 UI 调用：强制恢复 auto。"""
        session_id = self._state_key(session_id)
        self.repository.reset_session_state(session_id)
