"""
QuoteService 单元测试（不依赖 MySQL）。
用 stub 替换 ScheduleService / PricingRepository / SfDeliveryService。
"""

import os
import sys
import unittest
from datetime import datetime

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PY_ROOT = os.path.dirname(THIS_DIR)
if PY_ROOT not in sys.path:
    sys.path.insert(0, PY_ROOT)

from services.quote_service import QuoteService, QuoteRequest  # noqa: E402
from services.sf_delivery_service import DeliveryEstimate  # noqa: E402


class _ScheduleStub:
    def __init__(self, available=True, units=None):
        self.available = available
        self.units = units or [{"unitId": 1, "unitCode": "DJI-POCKET3-01",
                                "plannedShipAt": "2026-04-25T17:00:00",
                                "expectedArriveAt": "2026-04-26T10:00:00"}]

    def check_availability(self, model, start, end, city, shipping_mode):
        return {
            "available": self.available,
            "availableUnits": self.units if self.available else [],
            "reason": None if self.available else "no units",
            "shipping": {},
        }


class _PricingStub:
    def __init__(self, row=None):
        self._row = row

    def find_price(self, model_code, days):
        return self._row


class _DeliveryStub:
    def __init__(self, eta_text="明天到", hours=24):
        self._eta = eta_text
        self._hours = hours

    def estimate(self, city, shipping_mode=None, now=None):
        return DeliveryEstimate(
            carrier="sf", eta_hours=self._hours, eta_text=self._eta,
            arrive_at="2026-04-26T10:00:00", ship_deadline="2026-04-25T17:00:00",
            note=f"to={city}",
        )


def _mk(req, **kwargs):
    schedule = kwargs.pop("schedule", _ScheduleStub())
    pricing = kwargs.pop("pricing", _PricingStub({"daily_price": 170, "deposit": 2000, "remark": ""}))
    delivery = kwargs.pop("delivery", _DeliveryStub())
    svc = QuoteService(
        schedule_service=schedule,
        pricing_repository=pricing,
        sf_delivery_service=delivery,
        enabled=True,
    )
    return svc.resolve(req, asked_slots=kwargs.get("asked_slots"))


class QuoteServiceTests(unittest.TestCase):

    def test_model_unknown_needs_human(self):
        r = _mk(QuoteRequest(model_code=None, rent_start="2026-05-01", rent_end="2026-05-04", city="上海"))
        self.assertEqual(r.status, "needs_human")
        self.assertEqual(r.reason, "model_unknown")

    def test_dates_missing_needs_followup(self):
        r = _mk(QuoteRequest(model_code="DJI_POCKET3"))
        self.assertEqual(r.status, "need_more_info")
        self.assertEqual(r.reason, "dates_missing")
        self.assertIn("租期", r.followup_question)

    def test_dates_missing_after_asked_escalates(self):
        r = _mk(
            QuoteRequest(model_code="DJI_POCKET3"),
            asked_slots={"rent_dates"},
        )
        self.assertEqual(r.status, "needs_human")

    def test_price_not_configured_needs_human(self):
        r = _mk(
            QuoteRequest(model_code="UNKNOWN_MODEL", rent_start="2026-05-01", rent_end="2026-05-04", city="上海"),
            pricing=_PricingStub(None),
        )
        self.assertEqual(r.status, "needs_human")
        self.assertEqual(r.reason, "price_not_configured")

    def test_schedule_unavailable(self):
        r = _mk(
            QuoteRequest(model_code="DJI_POCKET3", rent_start="2026-05-01", rent_end="2026-05-04", city="上海"),
            schedule=_ScheduleStub(available=False),
        )
        self.assertEqual(r.status, "unavailable")
        self.assertIn("档期", r.reply_text)

    def test_city_missing_asks_once(self):
        r = _mk(QuoteRequest(model_code="DJI_POCKET3", rent_start="2026-05-01", rent_end="2026-05-04"))
        self.assertEqual(r.status, "need_more_info")
        self.assertEqual(r.reason, "city_missing")
        self.assertIn("城市", r.followup_question)
        # 报价要落在追问里（让买家先看到价格）
        self.assertIn("680", r.followup_question)  # 4 天 × 170

    def test_city_missing_after_asked_still_quotes(self):
        r = _mk(
            QuoteRequest(model_code="DJI_POCKET3", rent_start="2026-05-01", rent_end="2026-05-04"),
            asked_slots={"city"},
        )
        # 没城市时 shipping 句子应缺失但报价/档期可出
        self.assertEqual(r.status, "available")
        self.assertIn("680", r.reply_text)

    def test_available_full_quote(self):
        r = _mk(QuoteRequest(
            model_code="DJI_POCKET3",
            rent_start="2026-05-01",
            rent_end="2026-05-04",
            city="上海",
        ))
        self.assertEqual(r.status, "available")
        self.assertEqual(r.reason, "ok")
        self.assertEqual(r.quote["days"], 4)
        self.assertEqual(r.quote["total"], 680.0)
        self.assertEqual(r.quote["deposit"], 2000.0)
        self.assertIn("680", r.reply_text)
        self.assertIn("上海", r.reply_text)
        self.assertIn("明天到", r.reply_text)
        self.assertIn("DJI-POCKET3-01", r.reply_text)

    def test_invalid_date_range(self):
        r = _mk(QuoteRequest(
            model_code="DJI_POCKET3",
            rent_start="2026-05-10",
            rent_end="2026-05-05",
            city="上海",
        ))
        self.assertEqual(r.status, "needs_human")
        self.assertEqual(r.reason, "invalid_date_range")

    def test_pricing_repo_raises_goes_human(self):
        class _Boom:
            def find_price(self, *a, **kw):
                raise RuntimeError("db dead")
        r = _mk(
            QuoteRequest(model_code="DJI_POCKET3", rent_start="2026-05-01", rent_end="2026-05-04", city="上海"),
            pricing=_Boom(),
        )
        self.assertEqual(r.status, "needs_human")
        self.assertEqual(r.reason, "pricing_error")

    def test_schedule_service_raises_goes_human(self):
        class _Boom:
            def check_availability(self, *a, **kw):
                raise RuntimeError("schedule dead")
        r = _mk(
            QuoteRequest(model_code="DJI_POCKET3", rent_start="2026-05-01", rent_end="2026-05-04", city="上海"),
            schedule=_Boom(),
        )
        self.assertEqual(r.status, "needs_human")
        self.assertEqual(r.reason, "schedule_error")

    def test_delivery_failure_still_returns_quote(self):
        class _Boom:
            def estimate(self, *a, **kw):
                raise RuntimeError("sf api down")
        r = _mk(
            QuoteRequest(model_code="DJI_POCKET3", rent_start="2026-05-01", rent_end="2026-05-04", city="上海"),
            delivery=_Boom(),
        )
        self.assertEqual(r.status, "available")
        self.assertIn("680", r.reply_text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
