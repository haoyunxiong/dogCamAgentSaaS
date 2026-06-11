"""
Sprint 6: LearningService classifier + routing 单元测试。使用纯内存仓储替身，不连 MySQL。
"""
import os
import sys
import unittest
from typing import Any, Dict, List, Optional

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PY_ROOT = os.path.dirname(THIS_DIR)
if PY_ROOT not in sys.path:
    sys.path.insert(0, PY_ROOT)

from services.learning_service import (  # noqa: E402
    LearningService,
    classify_candidate,
    DEFAULT_STRUCTURED_CATEGORIES,
)


# ---------------------------------------------------------------------------
# 内存仓储替身
# ---------------------------------------------------------------------------
class _FakeRepo:
    def __init__(self):
        self.knowledge: List[Dict[str, Any]] = []
        self.structured: List[Dict[str, Any]] = []
        self._knowledge_seq = 0
        self._structured_seq = 0
        self._item_desc: Dict[str, str] = {}
        self._item_model: Dict[str, str] = {}
        self._chat_pairs: List[Dict[str, Any]] = []

    # —— LearningService 使用的方法 —— #
    def get_item_descriptions(self) -> Dict[str, str]:
        return dict(self._item_desc)

    def get_model_by_item_id(self, item_id: str) -> Optional[str]:
        return self._item_model.get(item_id)

    def scan_chat_pairs(self) -> List[Dict[str, Any]]:
        return list(self._chat_pairs)

    def create_learning_candidate(self, **kwargs) -> int:
        self._knowledge_seq += 1
        row = {"id": self._knowledge_seq, **kwargs}
        self.knowledge.append(row)
        return self._knowledge_seq

    def create_structured_learning_suggestion(self, **kwargs) -> int:
        self._structured_seq += 1
        row = {"id": self._structured_seq, **kwargs}
        self.structured.append(row)
        return self._structured_seq

    # Sprint 6+: 历史去重接口
    def list_learning_candidate_pairs(self):
        return [
            {"question": r.get("question", ""), "answer": r.get("final_answer", "")}
            for r in self.knowledge
        ]

    def list_structured_suggestion_pairs(self):
        return [
            {
                "question": r.get("user_message", ""),
                "answer": r.get("bot_or_human_reply", ""),
            }
            for r in self.structured
        ]


class _FakeConfig(dict):
    def get(self, k, default=None):
        return super().get(k, default)


# ---------------------------------------------------------------------------
# classify_candidate：覆盖各类目
# ---------------------------------------------------------------------------
class ClassifyCandidateTests(unittest.TestCase):
    def test_price_keyword(self):
        r = classify_candidate("能便宜点吗", "")
        self.assertEqual(r["category"], "price")
        self.assertGreaterEqual(r["confidence"], 0.8)

    def test_price_digit_short_question(self):
        r = classify_candidate("300块能租吗", "")
        self.assertEqual(r["category"], "price")

    def test_booking(self):
        r = classify_candidate("我想现在下单", "好的")
        self.assertEqual(r["category"], "booking")

    def test_schedule(self):
        r = classify_candidate("明天能取到机器吗", "")
        self.assertEqual(r["category"], "schedule")

    def test_shipping(self):
        r = classify_candidate("顺丰几天能到", "")
        self.assertEqual(r["category"], "shipping")

    def test_aftersale(self):
        r = classify_candidate("机器摔了怎么办", "")
        self.assertEqual(r["category"], "aftersale")

    def test_compat(self):
        r = classify_candidate("这个能接麦克风吗", "可以外接")
        self.assertEqual(r["category"], "compat")

    def test_accessory(self):
        r = classify_candidate("配件有哪些", "含充电器")
        self.assertEqual(r["category"], "accessory")

    def test_feature(self):
        r = classify_candidate("这款对焦怎么样", "")
        self.assertEqual(r["category"], "feature")

    def test_usage(self):
        r = classify_candidate("怎么开机", "长按电源键")
        self.assertEqual(r["category"], "usage")

    def test_faq_fallback(self):
        r = classify_candidate("你好", "你好")
        self.assertEqual(r["category"], "faq")

    def test_price_priority_over_others(self):
        # 同时含 price + schedule 关键词，price 优先
        r = classify_candidate("明天能取的话可以便宜点吗", "")
        self.assertEqual(r["category"], "price")


# ---------------------------------------------------------------------------
# LearningService._record_candidate 路由
# ---------------------------------------------------------------------------
class RecordCandidateRoutingTests(unittest.TestCase):
    def test_default_blacklist_routes_price_to_structured(self):
        repo = _FakeRepo()
        svc = LearningService(repo)
        result = svc._record_candidate(
            session_id="s1", item_id="i1", model_code="DJI_POCKET3",
            question="能便宜点吗", answer="最低 200",
        )
        self.assertEqual(result["bucket"], "structured")
        self.assertEqual(result["category"], "price")
        self.assertEqual(len(repo.structured), 1)
        self.assertEqual(len(repo.knowledge), 0)
        self.assertEqual(repo.structured[0]["category"], "price")

    def test_usage_goes_to_knowledge(self):
        repo = _FakeRepo()
        svc = LearningService(repo)
        result = svc._record_candidate(
            session_id="s1", item_id="i1", model_code=None,
            question="怎么开机", answer="长按电源键 3 秒",
        )
        self.assertEqual(result["bucket"], "knowledge")
        self.assertEqual(len(repo.knowledge), 1)
        self.assertEqual(len(repo.structured), 0)

    def test_faq_goes_to_knowledge(self):
        repo = _FakeRepo()
        svc = LearningService(repo)
        result = svc._record_candidate(
            session_id="s1", item_id=None, model_code=None,
            question="你好", answer="您好",
        )
        self.assertEqual(result["bucket"], "knowledge")

    def test_custom_blacklist_overrides_default(self):
        repo = _FakeRepo()
        # 仅把 aftersale 视为结构化，price 将不再进 structured
        svc = LearningService(repo, config=_FakeConfig(KNOWLEDGE_CATEGORY_BLACKLIST="aftersale"))
        r1 = svc._record_candidate(
            session_id="s1", item_id=None, model_code=None,
            question="能便宜点吗", answer="不行",
        )
        r2 = svc._record_candidate(
            session_id="s2", item_id=None, model_code=None,
            question="机器坏了怎么办", answer="联系客服",
        )
        self.assertEqual(r1["bucket"], "knowledge")
        self.assertEqual(r2["bucket"], "structured")

    def test_default_categories_match_documented_set(self):
        # 守护默认黑名单与文档对齐
        self.assertEqual(
            set(DEFAULT_STRUCTURED_CATEGORIES),
            {"price", "schedule", "shipping", "aftersale", "booking"},
        )


# ---------------------------------------------------------------------------
# capture_manual_takeover / extract_from_history 返回 & 分流
# ---------------------------------------------------------------------------
class ServiceHighLevelTests(unittest.TestCase):
    def test_capture_manual_takeover_returns_int_id(self):
        repo = _FakeRepo()
        svc = LearningService(repo)
        rid = svc.capture_manual_takeover("s1", "i1", "怎么开机", "长按电源")
        self.assertIsInstance(rid, int)
        self.assertGreater(rid, 0)
        self.assertEqual(len(repo.knowledge), 1)

    def test_capture_manual_takeover_price_into_structured(self):
        repo = _FakeRepo()
        svc = LearningService(repo)
        svc.capture_manual_takeover("s1", "i1", "能便宜点吗", "最低 180")
        self.assertEqual(len(repo.structured), 1)
        self.assertEqual(len(repo.knowledge), 0)

    def test_extract_from_history_splits_counters(self):
        repo = _FakeRepo()
        repo._chat_pairs = [
            {"id": 1, "chat_id": "c1", "item_id": "i1", "role": "user", "content": "怎么开机"},
            {"id": 2, "chat_id": "c1", "item_id": "i1", "role": "assistant", "content": "长按电源"},
            {"id": 3, "chat_id": "c1", "item_id": "i1", "role": "user", "content": "能便宜点吗"},
            {"id": 4, "chat_id": "c1", "item_id": "i1", "role": "assistant", "content": "最低 180"},
        ]
        svc = LearningService(repo)
        stats = svc.extract_from_history()
        self.assertEqual(stats["created"], 2)
        self.assertEqual(stats["knowledge"], 1)
        self.assertEqual(stats["structured"], 1)
        self.assertEqual(stats["raw_pairs"], 2)
        self.assertEqual(stats["deduped"], 0)
        self.assertEqual(stats["by_category"].get("usage"), 1)
        self.assertEqual(stats["by_category"].get("price"), 1)

    def test_extract_from_history_dedup_across_sessions(self):
        """同一 Q&A 跨会话只生成一条候选，并记录 hit 合并数。"""
        repo = _FakeRepo()
        repo._chat_pairs = [
            # session c1
            {"id": 1, "chat_id": "c1", "item_id": "i1", "role": "user", "content": "怎么开机"},
            {"id": 2, "chat_id": "c1", "item_id": "i1", "role": "assistant", "content": "长按电源"},
            # session c2 — 同 Q 同 A（大小写/空格变体也算）
            {"id": 3, "chat_id": "c2", "item_id": "i1", "role": "user", "content": "怎么开机  "},
            {"id": 4, "chat_id": "c2", "item_id": "i1", "role": "assistant", "content": "长按电源"},
            # session c3 — 不同 Q（砍价）
            {"id": 5, "chat_id": "c3", "item_id": "i2", "role": "user", "content": "能便宜点吗"},
            {"id": 6, "chat_id": "c3", "item_id": "i2", "role": "assistant", "content": "最低 180"},
        ]
        svc = LearningService(repo)
        stats = svc.extract_from_history()
        self.assertEqual(stats["raw_pairs"], 3)
        self.assertEqual(stats["deduped"], 1)       # 合并了 1 条重复
        self.assertEqual(stats["created"], 2)       # 最终入库 2 条
        self.assertEqual(stats["knowledge"], 1)     # 使用类 → 知识库
        self.assertEqual(stats["structured"], 1)    # 砍价 → 结构化
        self.assertEqual(len(repo.knowledge), 1)
        self.assertEqual(len(repo.structured), 1)

    def test_extract_from_history_skips_empty(self):
        repo = _FakeRepo()
        repo._chat_pairs = [
            {"id": 1, "chat_id": "c1", "item_id": "i1", "role": "user", "content": "   "},
            {"id": 2, "chat_id": "c1", "item_id": "i1", "role": "assistant", "content": "回复"},
        ]
        svc = LearningService(repo)
        stats = svc.extract_from_history()
        self.assertEqual(stats["created"], 0)

    def test_extract_from_history_skips_existing_candidates(self):
        """已在 learning_candidates / structured 表中的 Q&A，再次抽取不重复入库。"""
        repo = _FakeRepo()
        # 预置：knowledge 里已有一条 (怎么开机, 长按电源)
        repo.knowledge.append({
            "id": 99, "question": "怎么开机", "final_answer": "长按电源",
        })
        # 预置：structured 里已有一条 (能便宜点吗, 最低180)
        repo.structured.append({
            "id": 99, "category": "price",
            "user_message": "能便宜点吗", "bot_or_human_reply": "最低180",
        })
        repo._chat_pairs = [
            # 同 Q 同 A（大小写/空格）应跳过
            {"id": 1, "chat_id": "c1", "item_id": "i1", "role": "user", "content": "  怎么开机 "},
            {"id": 2, "chat_id": "c1", "item_id": "i1", "role": "assistant", "content": "长按电源"},
            {"id": 3, "chat_id": "c2", "item_id": "i1", "role": "user", "content": "能便宜点吗"},
            {"id": 4, "chat_id": "c2", "item_id": "i1", "role": "assistant", "content": "最低180"},
            # 全新 Q → 应入库
            {"id": 5, "chat_id": "c3", "item_id": "i2", "role": "user", "content": "支持外接麦克风吗"},
            {"id": 6, "chat_id": "c3", "item_id": "i2", "role": "assistant", "content": "支持"},
        ]
        svc = LearningService(repo)
        stats = svc.extract_from_history()
        self.assertEqual(stats["raw_pairs"], 3)
        self.assertEqual(stats["existing_skipped"], 2)
        self.assertEqual(stats["created"], 1)
        # 仅新增 1 条，原有数据不变
        self.assertEqual(len(repo.knowledge), 2)   # 原 1 + 新 1
        self.assertEqual(len(repo.structured), 1)  # 没变


if __name__ == "__main__":
    unittest.main()
