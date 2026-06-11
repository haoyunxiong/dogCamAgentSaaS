"""
QuoteService · 结构化报价 / 档期 / 物流决策层（Sprint 3）

输入：IntentRouter 判定为 SCHEDULE_QUOTE 的消息 + 已抽取的 slots + 会话上下文。
输出：给买家看的一段标准回复，或追问缺失信息的话术，或转人工。

本服务**不直接写库、不发消息**，由 ConversationProcessor 决定是否发送。
所有不确定 / 缺失 / 异常场景一律走 needs_human，绝不乱报价。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from loguru import logger


@dataclass
class QuoteRequest:
    model_code: Optional[str] = None
    rent_start: Optional[str] = None     # "YYYY-MM-DD"
    rent_end: Optional[str] = None       # "YYYY-MM-DD"
    city: Optional[str] = None
    shipping_mode: Optional[str] = None  # sf | sf_cold | self_pickup

    @property
    def days(self) -> Optional[int]:
        if not self.rent_start or not self.rent_end:
            return None
        try:
            a = datetime.fromisoformat(self.rent_start).date()
            b = datetime.fromisoformat(self.rent_end).date()
            d = (b - a).days + 1
            return d if d > 0 else None
        except Exception:
            return None

    def missing(self) -> List[str]:
        missing = []
        if not self.model_code:
            missing.append("model_code")
        if not self.rent_start:
            missing.append("rent_start")
        if not self.rent_end:
            missing.append("rent_end")
        # city 不是硬性必填，但没有 city 时时效话术会降级
        return missing


QuoteStatus = Literal["need_more_info", "available", "unavailable", "needs_human"]


@dataclass
class QuoteResult:
    status: QuoteStatus
    reply_text: str = ""
    followup_question: Optional[str] = None
    quote: Optional[Dict[str, Any]] = None
    schedule: Optional[Dict[str, Any]] = None
    shipping: Optional[Dict[str, Any]] = None
    reason: str = ""
    slots: Dict[str, Any] = field(default_factory=dict)

    def to_log_dict(self) -> Dict:
        return {
            "status": self.status,
            "reason": self.reason,
            "slots": self.slots,
            "has_quote": self.quote is not None,
            "has_schedule": self.schedule is not None,
            "has_shipping": self.shipping is not None,
        }


class QuoteService:
    """结构化询价 + 档期 + 时效。"""

    def __init__(
        self,
        *,
        schedule_service,
        pricing_repository,
        sf_delivery_service,
        enabled: bool = False,
    ):
        self.schedule_service = schedule_service
        self.pricing_repository = pricing_repository
        self.sf_delivery_service = sf_delivery_service
        self.enabled = enabled

    # ----------------------------------------------------------------- API

    def build_request(self, intent_slots: Dict[str, Optional[str]]) -> QuoteRequest:
        return QuoteRequest(
            model_code=intent_slots.get("model_code"),
            rent_start=intent_slots.get("rent_start"),
            rent_end=intent_slots.get("rent_end"),
            city=intent_slots.get("city"),
            shipping_mode=intent_slots.get("shipping_mode"),
        )

    def resolve(self, req: QuoteRequest, asked_slots: Optional[set] = None) -> QuoteResult:
        """主入口。"""
        asked_slots = asked_slots or set()
        slots_dbg: Dict[str, Any] = {
            "model_code": req.model_code,
            "rent_start": req.rent_start,
            "rent_end": req.rent_end,
            "city": req.city,
            "days": req.days,
        }

        # 1. 型号识别失败 → 直接转人工（绝不瞎猜价格）
        if not req.model_code:
            return QuoteResult(
                status="needs_human",
                reason="model_unknown",
                reply_text="宝稍等 我马上就来",
                slots=slots_dbg,
            )

        # 2. 缺日期 → 追问
        missing = req.missing()
        if "rent_start" in missing or "rent_end" in missing:
            # 避免重复追问
            if "rent_dates" in asked_slots:
                return QuoteResult(
                    status="needs_human",
                    reason="dates_missing_after_asked",
                    reply_text="宝稍等 我马上就来",
                    slots=slots_dbg,
                )
            return QuoteResult(
                status="need_more_info",
                reason="dates_missing",
                followup_question="麻烦发下具体租期（例如 5月1日到5月4日），我先帮您查档期和报价。",
                slots=slots_dbg,
            )

        days = req.days
        if not days or days <= 0:
            return QuoteResult(
                status="needs_human",
                reason="invalid_date_range",
                reply_text="宝稍等 我马上就来",
                slots=slots_dbg,
            )

        # 3. 查价格（分档）
        price_row = None
        try:
            price_row = self.pricing_repository.find_price(req.model_code, days)
        except Exception as e:
            logger.warning(f"[quote] find_price 异常，转人工: {e}")
            return QuoteResult(
                status="needs_human",
                reason="pricing_error",
                reply_text="宝稍等 我马上就来",
                slots=slots_dbg,
            )

        if not price_row:
            # 未配置价格 → 转人工，绝不猜
            return QuoteResult(
                status="needs_human",
                reason="price_not_configured",
                reply_text="宝稍等 我马上就来",
                slots=slots_dbg,
            )

        try:
            daily = float(price_row.get("daily_price") or 0)
            total_price = price_row.get("total_price")
            total = float(total_price) if total_price is not None else round(daily * days, 2)
            if total_price is not None and days > 0:
                daily = round(total / days, 2)
            deposit = float(price_row.get("deposit") or 0)
        except (TypeError, ValueError):
            return QuoteResult(
                status="needs_human",
                reason="pricing_bad_data",
                reply_text="宝稍等 我马上就来",
                slots=slots_dbg,
            )
        quote_info = {
            "days": days,
            "daily": daily,
            "total": total,
            "price_mode": "total" if price_row.get("total_price") is not None else "daily",
            "deposit": deposit,
            "remark": price_row.get("remark"),
        }

        # 4. 查档期
        try:
            avail = self.schedule_service.check_availability(
                req.model_code, req.rent_start, req.rent_end, req.city, req.shipping_mode,
            )
        except Exception as e:
            logger.warning(f"[quote] check_availability 异常，转人工: {e}")
            return QuoteResult(
                status="needs_human",
                reason="schedule_error",
                reply_text="宝稍等 我马上就来",
                slots=slots_dbg,
                quote=quote_info,
            )

        if not avail.get("available"):
            return QuoteResult(
                status="unavailable",
                reason="schedule_unavailable",
                reply_text=(
                    f"不好意思，{req.rent_start} 到 {req.rent_end} 这段档期已经排满了，"
                    f"换个日期我帮您再看看？"
                ),
                quote=quote_info,
                schedule=avail,
                slots=slots_dbg,
            )

        # 5. 缺城市 → 先给报价 + 档期，再追问城市
        if not req.city:
            if "city" not in asked_slots:
                followup = (
                    f"档期可以安排！这个租 {days} 天一共 {total:.0f} 元"
                    + (f"，押金 {deposit:.0f} 元" if deposit else "")
                    + "。请问发货城市是？我这边帮您查顺丰能几号到。"
                )
                return QuoteResult(
                    status="need_more_info",
                    reason="city_missing",
                    followup_question=followup,
                    quote=quote_info,
                    schedule=avail,
                    slots=slots_dbg,
                )
            # 追问过仍不给 → 继续走，没城市的话术也能返回

        # 6. 顺丰时效
        shipping_info: Dict[str, Any] = {}
        try:
            eta = self.sf_delivery_service.estimate(req.city, shipping_mode=req.shipping_mode)
            shipping_info = {
                "carrier": eta.carrier,
                "eta_hours": eta.eta_hours,
                "eta_text": eta.eta_text,
                "arrive_at": eta.arrive_at,
                "ship_deadline": eta.ship_deadline,
            }
        except Exception as e:
            logger.warning(f"[quote] delivery estimate 异常，降级: {e}")
            shipping_info = {}

        # 7. 组装标准话术
        reply = self._render_available_reply(req, quote_info, avail, shipping_info)
        return QuoteResult(
            status="available",
            reason="ok",
            reply_text=reply,
            quote=quote_info,
            schedule=avail,
            shipping=shipping_info,
            slots=slots_dbg,
        )

    # --------------------------------------------------------------- render

    def _render_available_reply(
        self,
        req: QuoteRequest,
        quote: Dict[str, Any],
        avail: Dict[str, Any],
        shipping: Dict[str, Any],
    ) -> str:
        days = quote["days"]
        total = quote["total"]
        daily = quote["daily"]
        deposit = quote.get("deposit") or 0

        lines = []
        lines.append(
            f"{req.rent_start} 到 {req.rent_end} 这段档期可以安排～"
        )
        if quote.get("price_mode") == "total":
            price_line = f"租金 {days} 天总价 {total:.0f} 元"
            if daily:
                price_line += f"（折合约 {daily:.0f}/天）"
        else:
            price_line = f"租金 {days} 天 × {daily:.0f}/天 = {total:.0f} 元"
        if deposit:
            price_line += f"，押金 {deposit:.0f} 元"
        lines.append(price_line)

        if shipping and shipping.get("eta_text"):
            city_part = f"发{req.city}" if req.city else "发您那边"
            lines.append(f"{city_part}顺丰{shipping['eta_text']}")

        # 推荐机器编号（让顾客更有信心）
        if avail.get("availableUnits"):
            unit = avail["availableUnits"][0]
            lines.append(f"机器：{unit.get('unitCode')}")

        lines.append("方便的话把租期和收货地址发我，我这边安排发出～")
        return "\n".join(lines)
