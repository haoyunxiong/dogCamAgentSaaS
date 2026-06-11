"""
BookingService 单元测试。使用内存版 RentalRepository 替身，不连 MySQL。
"""
import os
import sys
import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PY_ROOT = os.path.dirname(THIS_DIR)
if PY_ROOT not in sys.path:
    sys.path.insert(0, PY_ROOT)

from services.booking_service import (  # noqa: E402
    BookingService,
    STATE_COLLECTING,
    STATE_QUOTE_READY,
    STATE_ORDER_DRAFTED,
    STATE_CLOSED,
)


# ---------------------------------------------------------------------------
# 内存仓储：模拟 rental_repository.conn() 上下文 + execute 接口
# ---------------------------------------------------------------------------
class _MemoryConn:
    def __init__(self, store):
        self.store = store

    def execute(self, sql, params=()):
        sql_norm = " ".join(sql.split()).lower()
        if sql_norm.startswith("create table"):
            return _CursorNoop()
        if sql_norm.startswith("select * from booking_drafts where session_id"):
            sid = params[0]
            return _CursorOne(self.store.get(sid))
        if sql_norm.startswith("insert into booking_drafts"):
            (
                session_id, item_id, model_code, buyer_id, state, slots_json, quote_json,
                last_user_message, last_bot_message, order_id, closed_reason,
            ) = params
            old = self.store.get(session_id)
            row = {
                "session_id": session_id,
                "item_id": item_id or (old or {}).get("item_id"),
                "model_code": model_code or (old or {}).get("model_code"),
                "buyer_id": buyer_id or (old or {}).get("buyer_id"),
                "state": state,
                "slots_json": slots_json,
                "quote_json": quote_json if quote_json is not None else (old or {}).get("quote_json"),
                "last_user_message": last_user_message or (old or {}).get("last_user_message"),
                "last_bot_message": last_bot_message or (old or {}).get("last_bot_message"),
                "order_id": order_id or (old or {}).get("order_id"),
                "closed_reason": closed_reason,
                "updated_at": datetime.now(),
            }
            self.store[session_id] = row
            return _CursorNoop()
        if sql_norm.startswith("insert into rental_orders"):
            # 模拟 create_order 的底层 SQL（这里走不到，因为 create_order 在 repo 层）
            return _CursorNoop()
        raise AssertionError(f"unexpected SQL: {sql}")


class _CursorOne:
    def __init__(self, row):
        self._row = row

    def fetchone(self):
        return self._row


class _CursorNoop:
    lastrowid = 999

    def fetchone(self):
        return None


class _FakeRepo:
    def __init__(self):
        self._store = {}
        self.last_order_payload = None
        self._order_id_seq = 1000

    @contextmanager
    def conn(self):
        yield _MemoryConn(self._store)

    def create_order(self, payload):
        self._order_id_seq += 1
        self.last_order_payload = payload
        return self._order_id_seq


class _FakeNotify:
    def __init__(self):
        self.calls = []

    def notify_order(self, payload):
        self.calls.append(payload)


# ---------------------------------------------------------------------------
class BookingServiceTests(unittest.TestCase):
    def _make(self, enabled=True, **cfg_overrides):
        cfg = {"BOOKING_FSM_ENABLED": "True" if enabled else "False"}
        cfg.update(cfg_overrides)
        repo = _FakeRepo()
        notify = _FakeNotify()
        svc = BookingService(
            rental_repository=repo,
            config=cfg,
            notification_service=notify,
        )
        return svc, repo, notify

    # ------------------------- 基本开关 -------------------------
    def test_disabled_service_returns_noop(self):
        svc, _, _ = self._make(enabled=False)
        self.assertFalse(svc.enabled)
        res = svc.on_booking_confirm_intent(
            session_id="s1", item_id="i1", buyer_id="b1",
            slots={"model_code": "DJI"}, message="要租",
        )
        self.assertEqual(res, {"action": "noop"})

    # ------------------------- BOOKING_CONFIRM -------------------------
    def test_confirm_intent_missing_dates_returns_followup(self):
        svc, repo, _ = self._make()
        res = svc.on_booking_confirm_intent(
            session_id="s1", item_id="i1", buyer_id="b1",
            slots={"model_code": "DJI"}, message="我要租",
        )
        self.assertEqual(res["action"], "followup")
        self.assertIn("租期", res["reply_text"])
        draft = svc.get_draft("s1")
        self.assertEqual(draft["state"], STATE_COLLECTING)
        self.assertEqual(draft["slots"]["model_code"], "DJI")

    def test_confirm_intent_missing_model_asks_model(self):
        svc, *_ = self._make()
        res = svc.on_booking_confirm_intent(
            session_id="s1", item_id="i1", buyer_id="b1",
            slots={"rent_start": "2026-05-01", "rent_end": "2026-05-04"},
            message="我要下单",
        )
        self.assertEqual(res["action"], "followup")
        self.assertIn("型号", res["reply_text"])

    def test_confirm_intent_full_slots_returns_noop(self):
        svc, *_ = self._make()
        res = svc.on_booking_confirm_intent(
            session_id="s1", item_id="i1", buyer_id="b1",
            slots={"model_code": "DJI", "rent_start": "2026-05-01",
                   "rent_end": "2026-05-04", "city": "上海"},
            message="确认下单",
        )
        # 完整 slots：交给 SCHEDULE_QUOTE 流程，不抢活
        self.assertEqual(res["action"], "noop")
        draft = svc.get_draft("s1")
        self.assertEqual(draft["state"], STATE_COLLECTING)

    # ------------------------- on_quote_available -------------------------
    def test_on_quote_available_sets_quote_ready(self):
        svc, *_ = self._make()
        svc.on_quote_available(
            session_id="s1", item_id="i1", buyer_id="b1",
            slots={"model_code": "DJI", "rent_start": "2026-05-01",
                   "rent_end": "2026-05-04", "city": "上海"},
            quote={"days": 4, "daily": 100, "total": 400, "deposit": 500},
            reply_text="报价 400 元",
        )
        draft = svc.get_draft("s1")
        self.assertEqual(draft["state"], STATE_QUOTE_READY)
        self.assertEqual(draft["quote"]["total"], 400)
        self.assertEqual(draft["model_code"], "DJI")

    # ------------------------- handle_user_reply -------------------------
    def _prep_quote_ready(self, svc):
        svc.on_quote_available(
            session_id="s1", item_id="i1", buyer_id="b1",
            slots={"model_code": "DJI", "rent_start": "2026-05-01",
                   "rent_end": "2026-05-04", "city": "上海"},
            quote={"days": 4, "daily": 100, "total": 400, "deposit": 500},
            reply_text="报价 400 元",
        )

    def test_confirm_keyword_creates_order_draft(self):
        svc, repo, notify = self._make()
        self._prep_quote_ready(svc)
        res = svc.handle_user_reply(session_id="s1", message="好的 就这个")
        self.assertEqual(res["action"], "confirm_ok")
        self.assertIn("已帮您预记订单", res["reply_text"])
        self.assertEqual(res["state"], STATE_ORDER_DRAFTED)
        # 订单入库
        self.assertIsNotNone(repo.last_order_payload)
        self.assertEqual(repo.last_order_payload["model_code"], "DJI")
        self.assertEqual(repo.last_order_payload["order_status"], "draft")
        # 飞书通知
        self.assertEqual(len(notify.calls), 1)
        self.assertEqual(notify.calls[0]["type"], "booking_drafted")
        # 草稿状态
        draft = svc.get_draft("s1")
        self.assertEqual(draft["state"], STATE_ORDER_DRAFTED)
        self.assertIsNotNone(draft["order_id"])

    def test_cancel_keyword_closes_draft(self):
        svc, repo, notify = self._make()
        self._prep_quote_ready(svc)
        res = svc.handle_user_reply(session_id="s1", message="算了不租了")
        self.assertEqual(res["action"], "cancelled")
        self.assertIsNone(repo.last_order_payload)
        self.assertEqual(len(notify.calls), 0)
        draft = svc.get_draft("s1")
        self.assertEqual(draft["state"], STATE_CLOSED)
        self.assertEqual(draft["closed_reason"], "user_cancelled")

    def test_unrelated_reply_noop(self):
        svc, *_ = self._make()
        self._prep_quote_ready(svc)
        res = svc.handle_user_reply(session_id="s1", message="请问还能再便宜点吗")
        self.assertEqual(res["action"], "noop")
        draft = svc.get_draft("s1")
        self.assertEqual(draft["state"], STATE_QUOTE_READY)

    def test_no_draft_returns_noop(self):
        svc, *_ = self._make()
        res = svc.handle_user_reply(session_id="s-none", message="好的")
        self.assertEqual(res["action"], "noop")

    def test_expired_quote_closes_draft(self):
        svc, _, notify = self._make(BOOKING_QUOTE_TTL_MIN="1")
        self._prep_quote_ready(svc)
        # 手动把 updated_at 拨回 2 小时前
        svc.rental_repository._store["s1"]["updated_at"] = datetime.now() - timedelta(hours=2)
        res = svc.handle_user_reply(session_id="s1", message="好的")
        self.assertEqual(res["action"], "expired")
        self.assertEqual(len(notify.calls), 0)
        draft = svc.get_draft("s1")
        self.assertEqual(draft["state"], STATE_CLOSED)
        self.assertEqual(draft["closed_reason"], "quote_expired")

    def test_confirm_in_collecting_state_is_noop(self):
        svc, *_ = self._make()
        svc.on_booking_confirm_intent(
            session_id="s1", item_id="i1", buyer_id="b1",
            slots={"model_code": "DJI"}, message="要租",
        )
        res = svc.handle_user_reply(session_id="s1", message="好的")
        # collecting 状态下 handle_user_reply 不主动下单
        self.assertEqual(res["action"], "noop")

    # ------------------------- 兜底 / 异常 -------------------------
    def test_config_custom_confirm_keywords(self):
        svc, *_ = self._make(BOOKING_CONFIRM_KEYWORDS="签，成交")
        self._prep_quote_ready(svc)
        res = svc.handle_user_reply(session_id="s1", message="签")
        self.assertEqual(res["action"], "confirm_ok")

    def test_create_order_failure_still_marks_drafted(self):
        svc, repo, _ = self._make()
        self._prep_quote_ready(svc)
        # 让 create_order 抛异常
        def boom(_):
            raise RuntimeError("db down")
        repo.create_order = boom
        res = svc.handle_user_reply(session_id="s1", message="好的")
        self.assertEqual(res["action"], "confirm_ok")
        draft = svc.get_draft("s1")
        self.assertEqual(draft["state"], STATE_ORDER_DRAFTED)
        self.assertIsNone(draft["order_id"])


if __name__ == "__main__":
    unittest.main()
