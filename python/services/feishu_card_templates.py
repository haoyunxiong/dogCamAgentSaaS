"""
Sprint 7 · 飞书卡片统一模板

所有"需要人工介入"的场景在飞书使用同一结构的卡片：

    [原因] [型号] [会话链接] [快捷动作]

Reason 枚举（机器可归因）:
    - risk              风险词触发（价格/售后/投诉等敏感语义）
    - kb_miss           知识库检索未命中 / 低于阈值
    - quote_unavailable 结构化报价暂时无法给出（缺档期/缺价格表）
    - booking_confirm   建单状态机请求人工最终确认
    - model_unknown     无法识别具体型号

本模块只产出 dict payload，不发送；由上层（bridge / dbManager / feishu 发送器）
拿到 payload 后走现有发送通道。这样可以在不耦合网络层的前提下被单测覆盖。
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Reason 枚举
# ---------------------------------------------------------------------------
REASON_RISK = "risk"
REASON_KB_MISS = "kb_miss"
REASON_QUOTE_UNAVAILABLE = "quote_unavailable"
REASON_BOOKING_CONFIRM = "booking_confirm"
REASON_MODEL_UNKNOWN = "model_unknown"

ALL_REASONS = (
    REASON_RISK,
    REASON_KB_MISS,
    REASON_QUOTE_UNAVAILABLE,
    REASON_BOOKING_CONFIRM,
    REASON_MODEL_UNKNOWN,
)

_REASON_LABELS = {
    REASON_RISK: "⚠️ 风险词",
    REASON_KB_MISS: "❓ 知识库未命中",
    REASON_QUOTE_UNAVAILABLE: "💰 报价暂不可用",
    REASON_BOOKING_CONFIRM: "📝 建单待确认",
    REASON_MODEL_UNKNOWN: "🔍 型号待确认",
}

_REASON_COLORS = {
    REASON_RISK: "red",
    REASON_KB_MISS: "orange",
    REASON_QUOTE_UNAVAILABLE: "yellow",
    REASON_BOOKING_CONFIRM: "blue",
    REASON_MODEL_UNKNOWN: "grey",
}


def reason_label(reason: str) -> str:
    return _REASON_LABELS.get(reason, reason or "未分类")


def reason_color(reason: str) -> str:
    return _REASON_COLORS.get(reason, "grey")


# ---------------------------------------------------------------------------
# 卡片构建
# ---------------------------------------------------------------------------
@dataclass
class CardContext:
    reason: str
    pending_id: int
    user_question: str
    ai_draft: Optional[str] = None
    model_code: Optional[str] = None
    item_id: Optional[str] = None
    session_id: Optional[str] = None
    session_url: Optional[str] = None
    extra_fields: Optional[Dict[str, str]] = None


def build_pending_card(ctx: CardContext) -> Dict[str, Any]:
    """产出飞书交互卡片 payload（供后续 HTTP POST 发送）。

    输出结构参考飞书开放平台 Interactive Card 2.0 schema：
        {"config": {...}, "header": {...}, "elements": [...]}
    字段保持扁平，方便上层再包 outer message envelope。
    """
    reason = ctx.reason or REASON_KB_MISS
    title = reason_label(reason)
    header_color = reason_color(reason)

    lines: List[str] = []
    if ctx.model_code:
        lines.append(f"**型号**：{ctx.model_code}")
    if ctx.item_id:
        lines.append(f"**商品 ID**：{ctx.item_id}")
    if ctx.session_id:
        lines.append(f"**会话**：{ctx.session_id}")
    lines.append(f"**买家提问**：{(ctx.user_question or '').strip() or '—'}")
    if ctx.ai_draft:
        lines.append(f"**AI 草稿**：{ctx.ai_draft.strip()}")
    if ctx.extra_fields:
        for k, v in ctx.extra_fields.items():
            if v is None or v == "":
                continue
            lines.append(f"**{k}**：{v}")

    elements: List[Dict[str, Any]] = [
        {"tag": "div", "text": {"tag": "lark_md", "content": "\n".join(lines)}}
    ]

    # 会话跳转
    if ctx.session_url:
        elements.append(
            {
                "tag": "action",
                "actions": [
                    {
                        "tag": "button",
                        "text": {"tag": "plain_text", "content": "🔗 打开会话"},
                        "type": "default",
                        "url": ctx.session_url,
                    }
                ],
            }
        )

    # 快捷动作：确认发送 / 忽略
    elements.append(
        {
            "tag": "action",
            "actions": [
                {
                    "tag": "button",
                    "text": {"tag": "plain_text", "content": "✅ 确认发送"},
                    "type": "primary",
                    "value": {
                        "action_type": "approve",
                        "pending_id": ctx.pending_id,
                        "reason": reason,
                        "final_reply": ctx.ai_draft or "",
                    },
                },
                {
                    "tag": "button",
                    "text": {"tag": "plain_text", "content": "🚫 忽略"},
                    "type": "danger",
                    "value": {
                        "action_type": "reject",
                        "pending_id": ctx.pending_id,
                        "reason": reason,
                    },
                },
            ],
        }
    )

    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"tag": "plain_text", "content": title},
            "template": header_color,
        },
        "elements": elements,
        # 方便日志归因与下游统计
        "_meta": {
            "reason": reason,
            "pending_id": ctx.pending_id,
            "model_code": ctx.model_code,
            "session_id": ctx.session_id,
        },
    }


def validate_reason(reason: Optional[str]) -> str:
    """归一化外部传入的 reason；未知值回落到 kb_miss。"""
    if reason and reason in ALL_REASONS:
        return reason
    return REASON_KB_MISS
