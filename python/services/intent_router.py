"""
IntentRouter · 自动回复决策分流层（Sprint 1）

目的：把原本散落在 RentalAgentService.handle_pre_reply() 里的关键词判断，
抽成一个**只做分类**的纯组件，返回结构化枚举 + 已抽取 slots。

路由器本身不发消息、不写库、不改状态，调用方（ConversationProcessor）
根据返回结果决定走哪个分支。

决策优先级：
    IGNORE > RISK_TAKEOVER > BOOKING_CONFIRM > SCHEDULE_QUOTE > FAQ_KB > FALLBACK

初版为纯规则实现，覆盖最常见样例；不确定/混合意图时降级为 FAQ_KB 或 FALLBACK。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class IntentCategory(str, Enum):
    IGNORE = "ignore"                    # 系统消息 / 闲聊 / 无关
    RISK_TAKEOVER = "risk_takeover"      # 砍价 / 售后 / 纠纷 / 提示词攻击
    BOOKING_CONFIRM = "booking_confirm"  # 明确要下单 / 确认租
    SCHEDULE_QUOTE = "schedule_quote"    # 档期 / 费用 / 物流 / 是否可租
    FAQ_KB = "faq_kb"                    # 走知识库
    FALLBACK = "fallback"                # 默认走 LLM（保守）


@dataclass
class IntentResult:
    category: IntentCategory
    confidence: float
    reason: str
    slots: Dict[str, Optional[str]] = field(default_factory=dict)
    matched_keywords: List[str] = field(default_factory=list)

    def to_log_dict(self) -> Dict:
        return {
            "category": self.category.value,
            "confidence": round(self.confidence, 3),
            "reason": self.reason,
            "slots": {k: v for k, v in self.slots.items() if v},
            "matched": self.matched_keywords,
        }


# ---------------------------------------------------------------------------
# 关键词词表（初版，后续可放到 config 表）
# ---------------------------------------------------------------------------

# 风险类 —— 命中即转人工
RISK_BARGAIN = ["便宜", "少点", "优惠", "改价", "最低", "砍价", "优惠点", "刀", "多少钱出", "让点", "包邮"]
RISK_SENSITIVE = ["赔", "退款", "纠纷", "进水", "损坏", "投诉", "申诉", "差评", "举报"]
RISK_OFFPLATFORM = ["微信", "加我", "私聊", "vx", "v信", "微信号", "qq", "支付宝转账", "线下", "当面"]
RISK_PROMPT_INJECT = [
    "你是什么模型", "你是ai", "你是机器人", "chatgpt", "gpt", "claude", "大模型",
    "prompt", "system prompt", "忽略之前", "忽略前面", "你的指令",
]

# 明确下单意图
BOOKING_STRONG = ["下单", "拍下", "我要租", "确认租", "就租这个", "那就租", "付款", "付一下"]
BOOKING_WEAK = ["可以的话我就租", "没问题我租", "行我租", "ok下单"]

# 档期/费用/物流类
SCHEDULE_KW = ["档期", "可租", "哪天", "能租吗", "有货吗", "能借吗"]
PRICE_KW = ["多少钱", "价格", "费用", "租金", "一天多少", "几天多少", "租几天"]
SHIPPING_KW = ["发货", "到货", "顺丰", "陆运", "快递", "几天到", "多久到", "今天发", "明天发"]
DATE_KW = ["号", "日", "周末", "下周", "这周", "这月", "下月", "月中", "月底"]

# 城市（与 RentalAgentService 对齐，后续可统一维护）
CITY_KEYWORDS = [
    "上海", "北京", "深圳", "广州", "杭州", "苏州", "成都", "重庆",
    "武汉", "西安", "南京", "天津", "长沙", "青岛", "厦门",
]

# IGNORE —— 系统/闲聊短语（字面完全匹配或子串）
IGNORE_EXACT = {"嗯", "嗯嗯", "哦", "哦哦", "好的", "好", "收到", "ok", "OK", "在吗", "在么"}
IGNORE_CARD_MARKERS = ["[系统消息]", "[自动回复]", "订单已签收", "等待买家付款", "交易成功"]

# 系统/疑似攻击的方括号整条消息
BRACKET_SYSTEM_RE = re.compile(r"^\s*\[[^\]]+\]\s*$")
# ISO 日期
ISO_DATE_RE = re.compile(r"20\d{2}-\d{1,2}-\d{1,2}")
MONTH_DAY_RE = re.compile(r"(\d{1,2})[月/-](\d{1,2})[日号]?")


class IntentRouter:
    """根据买家消息 + 会话上下文做一次性分类。"""

    def __init__(
        self,
        *,
        rental_agent_service=None,
        enabled: bool = False,
        log_only: bool = True,
    ):
        """
        :param rental_agent_service: 复用其 detect_model_code / parse_date_range / detect_city
        :param enabled: 是否启用本路由（由 config INTENT_ROUTER_ENABLED 控制）
        :param log_only: 仅记录日志、不改变 ConversationProcessor 行为
        """
        self.rental_agent_service = rental_agent_service
        self.enabled = enabled
        self.log_only = log_only

    # ------------------------------------------------------------------ API

    def classify(
        self,
        message: str,
        *,
        item_description: Optional[str] = None,
        context: Optional[List[Dict]] = None,
    ) -> IntentResult:
        text = (message or "").strip()
        if not text:
            return IntentResult(IntentCategory.IGNORE, 1.0, "empty_message")

        slots = self._extract_slots(text, item_description=item_description)

        # 0. IGNORE
        if self._is_ignore(text):
            return IntentResult(IntentCategory.IGNORE, 0.95, "ignore_system_or_smalltalk", slots)

        # 1. RISK
        risk_hit = self._match_risk(text)
        if risk_hit:
            return IntentResult(
                IntentCategory.RISK_TAKEOVER, 0.9,
                f"risk:{risk_hit[0]}", slots, matched_keywords=risk_hit[1],
            )

        # 2. BOOKING_CONFIRM —— 明确要下单
        booking_hit = self._match_booking(text)
        if booking_hit:
            return IntentResult(
                IntentCategory.BOOKING_CONFIRM, 0.85,
                "booking_confirm", slots, matched_keywords=booking_hit,
            )

        # 3. SCHEDULE_QUOTE —— 档期/费用/物流
        sq_hit = self._match_schedule_quote(text, slots)
        if sq_hit:
            return IntentResult(
                IntentCategory.SCHEDULE_QUOTE, sq_hit[0],
                sq_hit[1], slots, matched_keywords=sq_hit[2],
            )

        # 4. 默认走 FAQ_KB（让上层用知识库判断），若完全没有任何特征则 FALLBACK
        if len(text) >= 4:
            return IntentResult(IntentCategory.FAQ_KB, 0.5, "default_faq_kb", slots)
        return IntentResult(IntentCategory.FALLBACK, 0.3, "short_message_fallback", slots)

    # ---------------------------------------------------------------- helpers

    def _extract_slots(self, text: str, *, item_description: Optional[str]) -> Dict[str, Optional[str]]:
        slots: Dict[str, Optional[str]] = {
            "model_code": None,
            "rent_start": None,
            "rent_end": None,
            "city": None,
        }

        # 型号
        if self.rental_agent_service is not None:
            try:
                # detect_model_code 实际用的是 item_description（包含标题）
                desc = item_description or text
                slots["model_code"] = self.rental_agent_service.detect_model_code(desc)
            except Exception:
                slots["model_code"] = None
            try:
                start, end = self.rental_agent_service.parse_date_range(text)
                slots["rent_start"] = start
                slots["rent_end"] = end
            except Exception:
                pass
            try:
                slots["city"] = self.rental_agent_service.detect_city(text)
            except Exception:
                pass
        else:
            # 无依赖时的降级正则
            iso = ISO_DATE_RE.findall(text)
            if len(iso) >= 2:
                slots["rent_start"], slots["rent_end"] = iso[0], iso[1]
            elif len(iso) == 1:
                slots["rent_start"] = iso[0]
            for c in CITY_KEYWORDS:
                if c in text:
                    slots["city"] = c
                    break

        return slots

    def _is_ignore(self, text: str) -> bool:
        stripped = text.strip()
        if stripped in IGNORE_EXACT:
            return True
        if BRACKET_SYSTEM_RE.match(stripped):
            return True
        for marker in IGNORE_CARD_MARKERS:
            if marker in stripped:
                return True
        return False

    def _match_risk(self, text: str):
        lower = text.lower()
        for tag, words in (
            ("prompt_inject", RISK_PROMPT_INJECT),
            ("sensitive", RISK_SENSITIVE),
            ("offplatform", RISK_OFFPLATFORM),
            ("bargain", RISK_BARGAIN),
        ):
            hit = [w for w in words if w in lower]
            if hit:
                return (tag, hit)
        return None

    def _match_booking(self, text: str) -> List[str]:
        hit = [w for w in BOOKING_STRONG if w in text]
        if hit:
            return hit
        hit = [w for w in BOOKING_WEAK if w in text]
        return hit

    def _match_schedule_quote(self, text: str, slots: Dict):
        """返回 (confidence, reason, matched_keywords) 或 None。"""
        kw_schedule = [w for w in SCHEDULE_KW if w in text]
        kw_price = [w for w in PRICE_KW if w in text]
        kw_ship = [w for w in SHIPPING_KW if w in text]
        has_date = bool(slots.get("rent_start") or MONTH_DAY_RE.search(text) or ISO_DATE_RE.search(text))
        has_date_kw = any(k in text for k in DATE_KW)

        total_hits = kw_schedule + kw_price + kw_ship
        if total_hits:
            conf = 0.8 if len(total_hits) >= 2 or (has_date and total_hits) else 0.7
            reason_parts = []
            if kw_schedule:
                reason_parts.append("schedule_kw")
            if kw_price:
                reason_parts.append("price_kw")
            if kw_ship:
                reason_parts.append("shipping_kw")
            if has_date:
                reason_parts.append("has_date")
            return (conf, "schedule_quote:" + "+".join(reason_parts), total_hits)

        # 纯日期 + 城市（"15号上海"）也视为档期询问
        if (has_date or has_date_kw) and slots.get("city"):
            return (0.65, "schedule_quote:date_city_only", [])

        return None
