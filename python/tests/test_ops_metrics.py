"""
Sprint 7 · OpsMetricsService 单元测试（内存仓储，不连 MySQL）
"""
import os
import sys
import unittest
from contextlib import contextmanager

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PY_ROOT = os.path.dirname(THIS_DIR)
if PY_ROOT not in sys.path:
    sys.path.insert(0, PY_ROOT)

from services.ops_metrics_service import OpsMetricsService  # noqa: E402


class _FakeConn:
    """根据 SQL 前缀分派到 counters dict。"""
    def __init__(self, counters):
        self.counters = counters

    def execute(self, sql, params=()):
        norm = " ".join(sql.split()).lower()
        for key, value in self.counters.items():
            if key in norm:
                return _Row(value)
        return _Row(0)


class _Row:
    def __init__(self, value):
        self.value = value

    def fetchone(self):
        # mimic DictCursor row
        return {"c": self.value}


class _FakeRepo:
    def __init__(self, counters):
        self._counters = counters

    @contextmanager
    def conn(self):
        yield _FakeConn(self._counters)


class _BrokenRepo:
    @contextmanager
    def conn(self):
        raise RuntimeError("db down")
        yield None  # pragma: no cover


class OpsMetricsTests(unittest.TestCase):
    def test_individual_counters(self):
        repo = _FakeRepo({
            "from takeover_tasks where date(created_at)": 7,
            "from takeover_tasks where status in": 3,
            "from booking_drafts where date(updated_at) = curdate() and (state": 2,
            "from booking_drafts where date(updated_at)": 5,
            "from structured_learning_suggestions where status": 4,
            "from feishu_pending_replies where status": 1,
            "from chat_messages where role='assistant'": 93,
        })
        svc = OpsMetricsService(repo)
        self.assertEqual(svc.count_manual_takeover_today(), 7)
        self.assertEqual(svc.count_takeover_pending(), 3)
        self.assertEqual(svc.count_booking_drafts_today(), 5)
        self.assertEqual(svc.count_booking_converted_today(), 2)
        self.assertEqual(svc.count_structured_pending(), 4)
        self.assertEqual(svc.count_feishu_pending(), 1)
        self.assertEqual(svc.count_auto_reply_today(), 93)

    def test_snapshot_shape_and_rates(self):
        repo = _FakeRepo({
            "from takeover_tasks where date(created_at)": 7,
            "from takeover_tasks where status in": 3,
            "from booking_drafts where date(updated_at) = curdate() and (state": 2,
            "from booking_drafts where date(updated_at)": 5,
            "from structured_learning_suggestions where status": 4,
            "from feishu_pending_replies where status": 1,
            "from chat_messages where role='assistant'": 93,
        })
        snap = OpsMetricsService(repo).get_today_snapshot()
        self.assertEqual(snap["auto_reply_today"], 93)
        self.assertEqual(snap["manual_takeover_today"], 7)
        self.assertEqual(snap["takeover_pending"], 3)
        self.assertEqual(snap["booking_drafts_today"], 5)
        self.assertEqual(snap["booking_converted_today"], 2)
        # 2/5 = 0.4
        self.assertAlmostEqual(snap["booking_conversion_rate"], 0.4, places=4)
        # 93 / (93+7) = 0.93
        self.assertAlmostEqual(snap["hit_rate"], 0.93, places=4)
        self.assertEqual(snap["structured_pending"], 4)
        self.assertEqual(snap["feishu_pending"], 1)
        self.assertIn("generated_at", snap)

    def test_zero_data_returns_zero_rates(self):
        repo = _FakeRepo({})  # 所有查询都 hit 默认 0
        snap = OpsMetricsService(repo).get_today_snapshot()
        self.assertEqual(snap["booking_conversion_rate"], 0.0)
        self.assertEqual(snap["hit_rate"], 0.0)
        self.assertEqual(snap["auto_reply_today"], 0)

    def test_repo_exception_does_not_crash(self):
        snap = OpsMetricsService(_BrokenRepo()).get_today_snapshot()
        # 所有计数应为 0，但结构完整
        self.assertEqual(snap["auto_reply_today"], 0)
        self.assertEqual(snap["manual_takeover_today"], 0)
        self.assertEqual(snap["booking_conversion_rate"], 0.0)
        self.assertEqual(snap["hit_rate"], 0.0)


if __name__ == "__main__":
    unittest.main()
