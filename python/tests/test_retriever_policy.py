"""
KnowledgeRetriever.search_with_policy 单元测试（不依赖 FAISS / MySQL）。
"""

import asyncio
import os
import sys
import unittest

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PY_ROOT = os.path.dirname(THIS_DIR)
if PY_ROOT not in sys.path:
    sys.path.insert(0, PY_ROOT)

from knowledge_base.retriever import KnowledgeRetriever, _parse_tags  # noqa: E402


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


class _RetrieverStub(KnowledgeRetriever):
    """跳过 __init__ 里的索引加载，直接注入 search() 结果。"""
    def __init__(self, config, canned):
        self.config = config
        self._canned = canned

    async def search(self, query, item_id=None, top_k=3, biz_item_code=None, model_code=None):
        return list(self._canned)


class ParseTagsTests(unittest.TestCase):
    def test_json_array(self):
        self.assertEqual(_parse_tags('["faq", "usage"]'), ["faq", "usage"])

    def test_comma(self):
        self.assertEqual(_parse_tags("price, shipping"), ["price", "shipping"])

    def test_cn_comma(self):
        self.assertEqual(_parse_tags("price，shipping"), ["price", "shipping"])

    def test_empty(self):
        self.assertEqual(_parse_tags(""), [])
        self.assertEqual(_parse_tags(None), [])


class PolicyTests(unittest.TestCase):
    def _make(self, canned, **cfg_override):
        cfg = {
            "KNOWLEDGE_MIN_SCORE_DEFAULT": "0.75",
            "KNOWLEDGE_CATEGORY_BLACKLIST": "price,schedule,shipping,aftersale,booking",
            **cfg_override,
        }
        return _RetrieverStub(cfg, canned)

    def test_accept_high_score_faq(self):
        stub = self._make([
            {"id": 1, "question": "怎么用", "answer": "按开关", "score": 0.9, "tags": ["usage"], "confidence_threshold": None},
        ])
        hits, dbg = _run(stub.search_with_policy("怎么用"))
        self.assertEqual(len(hits), 1)
        self.assertEqual(dbg["reason"], "ok")

    def test_reject_low_score(self):
        stub = self._make([
            {"id": 2, "question": "？", "answer": "？", "score": 0.6, "tags": ["faq"], "confidence_threshold": None},
        ])
        hits, dbg = _run(stub.search_with_policy("?"))
        self.assertEqual(hits, [])
        self.assertEqual(dbg["reason"], "all_rejected")
        self.assertTrue(dbg["rejected"][0]["reason"].startswith("below_threshold"))

    def test_reject_blacklist_price(self):
        stub = self._make([
            {"id": 3, "question": "多少钱", "answer": "180", "score": 0.95, "tags": ["price"], "confidence_threshold": None},
        ])
        hits, dbg = _run(stub.search_with_policy("多少钱"))
        self.assertEqual(hits, [])
        self.assertIn("blacklist_tag", dbg["rejected"][0]["reason"])

    def test_reject_blacklist_schedule(self):
        stub = self._make([
            {"id": 4, "question": "明天能发吗", "answer": "能", "score": 0.9, "tags": ["shipping"], "confidence_threshold": None},
        ])
        hits, _ = _run(stub.search_with_policy("明天能发吗"))
        self.assertEqual(hits, [])

    def test_per_entry_threshold_overrides_default(self):
        # 条目 threshold 0.90，score 0.80 → 应被拒
        stub = self._make([
            {"id": 5, "question": "xx", "answer": "yy", "score": 0.80, "tags": ["usage"], "confidence_threshold": 0.90},
        ])
        hits, dbg = _run(stub.search_with_policy("xx"))
        self.assertEqual(hits, [])
        self.assertIn("below_threshold(0.9)", dbg["rejected"][0]["reason"])

    def test_no_hit(self):
        stub = self._make([])
        hits, dbg = _run(stub.search_with_policy("x"))
        self.assertEqual(hits, [])
        self.assertEqual(dbg["reason"], "no_hit")

    def test_custom_blacklist_via_config(self):
        # 只把 aftersale 视作黑名单，price 应该被放行
        stub = self._make(
            [{"id": 6, "question": "多少钱", "answer": "180", "score": 0.9, "tags": ["price"], "confidence_threshold": None}],
            KNOWLEDGE_CATEGORY_BLACKLIST="aftersale",
        )
        hits, _ = _run(stub.search_with_policy("多少钱"))
        self.assertEqual(len(hits), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
