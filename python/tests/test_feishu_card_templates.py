"""
Sprint 7 · 飞书卡片模板单元测试
"""
import os
import sys
import unittest

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PY_ROOT = os.path.dirname(THIS_DIR)
if PY_ROOT not in sys.path:
    sys.path.insert(0, PY_ROOT)

from services.feishu_card_templates import (  # noqa: E402
    ALL_REASONS,
    CardContext,
    REASON_BOOKING_CONFIRM,
    REASON_KB_MISS,
    REASON_MODEL_UNKNOWN,
    REASON_QUOTE_UNAVAILABLE,
    REASON_RISK,
    build_pending_card,
    reason_color,
    reason_label,
    validate_reason,
)


class ReasonEnumTests(unittest.TestCase):
    def test_all_reasons_set(self):
        self.assertEqual(
            set(ALL_REASONS),
            {
                REASON_RISK,
                REASON_KB_MISS,
                REASON_QUOTE_UNAVAILABLE,
                REASON_BOOKING_CONFIRM,
                REASON_MODEL_UNKNOWN,
            },
        )

    def test_each_reason_has_label_and_color(self):
        for r in ALL_REASONS:
            self.assertTrue(reason_label(r))
            self.assertTrue(reason_color(r))

    def test_validate_reason_unknown_falls_back_kb_miss(self):
        self.assertEqual(validate_reason(None), REASON_KB_MISS)
        self.assertEqual(validate_reason(""), REASON_KB_MISS)
        self.assertEqual(validate_reason("nope"), REASON_KB_MISS)

    def test_validate_reason_passthrough(self):
        self.assertEqual(validate_reason(REASON_RISK), REASON_RISK)


class BuildPendingCardTests(unittest.TestCase):
    def _build(self, **overrides):
        ctx = CardContext(
            reason=REASON_KB_MISS,
            pending_id=42,
            user_question="能便宜点吗",
            ai_draft="您好，价格面议",
            model_code="DJI_POCKET3",
            item_id="IT_001",
            session_id="S_001",
            session_url="https://www.goofish.com/im?sid=S_001",
        )
        for k, v in overrides.items():
            setattr(ctx, k, v)
        return build_pending_card(ctx)

    def test_card_has_required_top_level_keys(self):
        card = self._build()
        self.assertIn("config", card)
        self.assertIn("header", card)
        self.assertIn("elements", card)
        self.assertIn("_meta", card)

    def test_header_title_reflects_reason(self):
        card_risk = self._build(reason=REASON_RISK)
        self.assertIn("风险", card_risk["header"]["title"]["content"])
        card_kb = self._build(reason=REASON_KB_MISS)
        self.assertIn("知识库", card_kb["header"]["title"]["content"])

    def test_body_contains_model_and_question(self):
        card = self._build()
        body_text = card["elements"][0]["text"]["content"]
        self.assertIn("DJI_POCKET3", body_text)
        self.assertIn("能便宜点吗", body_text)
        self.assertIn("您好，价格面议", body_text)

    def test_has_session_link_button(self):
        card = self._build()
        url_buttons = [
            a for el in card["elements"]
            if el.get("tag") == "action"
            for a in el.get("actions", [])
            if a.get("url")
        ]
        self.assertEqual(len(url_buttons), 1)
        self.assertTrue(url_buttons[0]["url"].startswith("http"))

    def test_has_approve_and_reject_buttons(self):
        card = self._build()
        types = [
            a["value"].get("action_type")
            for el in card["elements"]
            if el.get("tag") == "action"
            for a in el.get("actions", [])
            if "value" in a
        ]
        self.assertIn("approve", types)
        self.assertIn("reject", types)

    def test_approve_button_carries_pending_id_and_draft(self):
        card = self._build()
        approve = None
        for el in card["elements"]:
            if el.get("tag") != "action":
                continue
            for a in el.get("actions", []):
                if a.get("value", {}).get("action_type") == "approve":
                    approve = a
                    break
        self.assertIsNotNone(approve)
        self.assertEqual(approve["value"]["pending_id"], 42)
        self.assertEqual(approve["value"]["final_reply"], "您好，价格面议")
        self.assertEqual(approve["value"]["reason"], REASON_KB_MISS)

    def test_no_session_url_omits_link_button(self):
        card = self._build(session_url=None)
        urls = [
            a.get("url")
            for el in card["elements"]
            if el.get("tag") == "action"
            for a in el.get("actions", [])
        ]
        self.assertTrue(all(u is None for u in urls))

    def test_extra_fields_rendered(self):
        card = self._build(extra_fields={"报价": "¥180/天", "档期": "4/22-4/24"})
        body_text = card["elements"][0]["text"]["content"]
        self.assertIn("¥180/天", body_text)
        self.assertIn("4/22-4/24", body_text)

    def test_meta_fields(self):
        card = self._build(reason=REASON_BOOKING_CONFIRM)
        meta = card["_meta"]
        self.assertEqual(meta["reason"], REASON_BOOKING_CONFIRM)
        self.assertEqual(meta["pending_id"], 42)
        self.assertEqual(meta["model_code"], "DJI_POCKET3")
        self.assertEqual(meta["session_id"], "S_001")


if __name__ == "__main__":
    unittest.main()
