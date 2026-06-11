import json
from datetime import datetime, time
from typing import Any, Dict, Optional

import requests
from loguru import logger

from .feishu_card_templates import CardContext, build_pending_card, validate_reason
from .rental_repository import RentalRepository


class NotificationService:
    def __init__(self, repository: RentalRepository):
        self.repository = repository

    def _in_dnd(self, current: Optional[datetime] = None) -> bool:
        current = current or datetime.now()
        configs = self.repository.list_configs()
        start = configs.get("PHONE_DND_START", "01:00")
        end = configs.get("PHONE_DND_END", "09:00")
        try:
            start_time = time.fromisoformat(start)
            end_time = time.fromisoformat(end)
        except ValueError:
            return False

        current_time = current.time()
        if start_time <= end_time:
            return start_time <= current_time < end_time
        return current_time >= start_time or current_time < end_time

    def _emit(self, level: str, channel: str, payload: Dict[str, Any]):
        logger.log(level.upper(), f"[notify:{channel}] {json.dumps(payload, ensure_ascii=False)}")

    def _post_feishu(self, webhook: str, body: Dict[str, Any]) -> bool:
        if not webhook:
            return False
        try:
            response = requests.post(webhook, json=body, timeout=8)
            response.raise_for_status()
            return True
        except Exception as exc:
            logger.warning(f"[notify:feishu] 发送失败: {exc}")
            return False

    def _text(self, value: Any) -> str:
        if value in (None, "", []):
            return "-"
        if isinstance(value, float):
            return f"{value:.2f}"
        return str(value).replace("T", " ")

    def _field(self, label: str, value: Any, *, short: bool = True) -> Dict[str, Any]:
        return {
            "is_short": short,
            "text": {
                "tag": "lark_md",
                "content": f"**{label}**\n{self._text(value)}",
            },
        }

    def _build_card(self, *, title: str, template: str, fields: list[Dict[str, Any]], question: Optional[str] = None) -> Dict[str, Any]:
        elements = []
        if fields:
            elements.append({"tag": "div", "fields": fields})
        if question not in (None, "", []):
            elements.append({"tag": "hr"})
            elements.append(
                {
                    "tag": "div",
                    "text": {
                        "tag": "lark_md",
                        "content": f"**用户原话**\n{self._text(question)}",
                    },
                }
            )
        return {
            "msg_type": "interactive",
            "card": {
                "config": {
                    "wide_screen_mode": True,
                    "enable_forward": True,
                },
                "header": {
                    "template": template,
                    "title": {
                        "tag": "plain_text",
                        "content": title,
                    },
                },
                "elements": elements,
            },
        }

    def _reason_label(self, reason: Any) -> str:
        if reason == "bargain_or_change_price":
            return "议价 / 改价"
        if reason == "sensitive_after_sale":
            return "敏感售后"
        if reason == "faq_miss":
            return "常见问答未命中"
        if reason == "schedule_unavailable":
            return "档期暂无法承诺"
        if reason == "price_followup":
            return "价格问题待人工跟进"
        return self._text(reason)

    def _priority_label(self, priority: Any) -> str:
        if priority == "high":
            return "高优先级"
        if priority == "normal":
            return "普通"
        return self._text(priority)

    def _shipping_mode_label(self, mode: Any) -> str:
        if mode == "land":
            return "陆运"
        if mode == "express":
            return "普通快递"
        if mode == "next_morning":
            return "次晨达"
        return self._text(mode)

    def _order_type_label(self, event_type: Any) -> str:
        if event_type == "order_created":
            return "新建订单"
        if event_type == "shipping_updated":
            return "物流更新"
        if event_type == "deposit_status_changed":
            return "免押状态变化"
        return self._text(event_type)

    def notify_takeover(self, task: Dict[str, Any]):
        payload = {
            "channel": "feishu_sales",
            "taskId": task.get("id"),
            "sessionId": task.get("session_id"),
            "modelCode": task.get("model_code"),
            "itemId": task.get("item_id"),
            "reason": task.get("reason"),
            "priority": task.get("priority"),
            "latestQuestion": task.get("latest_question"),
        }
        webhook = self.repository.get_config("FEISHU_WEBHOOK_SALES", "")
        body = self._build_card(
            title="闲鱼租赁人工接管通知",
            template="red" if task.get("priority") == "high" else "orange",
            fields=[
                self._field("任务编号", task.get("id")),
                self._field("优先级", self._priority_label(task.get("priority"))),
                self._field("会话编号", task.get("session_id")),
                self._field("商品 ID", task.get("item_id")),
                self._field("型号编码", task.get("model_code")),
                self._field("接管原因", self._reason_label(task.get("reason"))),
                self._field("创建时间", task.get("created_at")),
                self._field("当前状态", task.get("status")),
            ],
            question=task.get("latest_question"),
        )
        self._post_feishu(webhook, body)
        self._emit("warning", "feishu_sales", payload)

    def notify_order(self, payload: Dict[str, Any]):
        event = {"channel": "feishu_order", **payload}
        webhook = self.repository.get_config("FEISHU_WEBHOOK_ORDER", "")
        event_type = payload.get("type")
        title = "闲鱼租赁物流更新" if event_type == "shipping_updated" else "闲鱼租赁履约通知"
        template = "blue" if event_type == "shipping_updated" else "green"
        body = self._build_card(
            title=title,
            template=template,
            fields=[
                self._field("通知类型", self._order_type_label(event_type)),
                self._field("订单编号", payload.get("orderId")),
                self._field("型号编码", payload.get("modelCode")),
                self._field("设备 ID", payload.get("unitId")),
                self._field("租期", payload.get("rentRange")),
                self._field("金额", payload.get("fee")),
                self._field("计划发货", payload.get("plannedShipAt")),
                self._field("运单号", payload.get("trackingNo")),
                self._field("物流方式", self._shipping_mode_label(payload.get("shippingMode"))),
                self._field("最新物流", payload.get("latestStatus")),
                self._field("免押单号", payload.get("depositOrderNo")),
                self._field("免押状态", payload.get("depositStatusLabel") or payload.get("depositStatus")),
                self._field("来源订单", payload.get("sourceOrderNo")),
                self._field("客户", payload.get("customerName") or payload.get("customerPhone")),
                self._field("收货地址", payload.get("address"), short=False),
            ],
        )
        self._post_feishu(webhook, body)
        self._emit("info", "feishu_order", event)

    def notify_pending_reply(
        self,
        *,
        pending_id: int,
        user_question: str,
        ai_draft: Optional[str] = None,
        reason: Optional[str] = None,
        model_code: Optional[str] = None,
        item_id: Optional[str] = None,
        session_id: Optional[str] = None,
        session_url: Optional[str] = None,
        extra_fields: Optional[Dict[str, str]] = None,
    ) -> bool:
        """Sprint 7：把待人工确认的回复通过统一飞书卡片推送到销售群。"""
        ctx = CardContext(
            reason=validate_reason(reason),
            pending_id=pending_id,
            user_question=user_question or "",
            ai_draft=ai_draft,
            model_code=model_code,
            item_id=item_id,
            session_id=session_id,
            session_url=session_url,
            extra_fields=extra_fields,
        )
        card = build_pending_card(ctx)
        webhook = self.repository.get_config("FEISHU_WEBHOOK_SALES", "")
        body = {"msg_type": "interactive", "card": card}
        ok = self._post_feishu(webhook, body)
        self._emit(
            "warning" if ok else "error",
            "feishu_pending",
            {
                "pending_id": pending_id,
                "reason": ctx.reason,
                "model_code": model_code,
                "session_id": session_id,
                "sent": ok,
            },
        )
        return ok

    def notify_phone_escalation(self, task: Dict[str, Any]) -> bool:
        if self.repository.get_config("PHONE_ALERT_ENABLED", "False").strip().lower() != "true":
            return False
        if self._in_dnd():
            logger.info(f"[notify:phone] 当前处于勿扰时段，跳过电话通知 task={task.get('id')}")
            return False
        payload = {
            "channel": "phone",
            "taskId": task.get("id"),
            "sessionId": task.get("session_id"),
            "reason": task.get("reason"),
            "latestQuestion": task.get("latest_question"),
        }
        self._emit("error", "phone", payload)
        return True
