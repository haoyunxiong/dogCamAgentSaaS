import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .learning_service import LearningService
from .schedule_service import ScheduleService
from .takeover_service import TakeoverService


# 功能性问题关键词（需要联网查询后人工确认的）
FUNCTIONAL_KEYWORDS = [
    "怎么用", "教程", "使用方法", "操作", "设置", "连接", "充电", "续航",
    "兼容", "适配", "支持", "格式", "导出", "传输", "存储", "内存",
    "固件", "升级", "更新", "重置", "故障", "维修", "保修",
]


class RentalAgentService:
    def __init__(self, repository, schedule_service: ScheduleService, takeover_service: TakeoverService, learning_service: LearningService):
        self.repository = repository
        self.schedule_service = schedule_service
        self.takeover_service = takeover_service
        self.learning_service = learning_service
        self.bargain_keywords = ["便宜", "少点", "优惠", "改价", "最低", "砍价", "优惠点", "刀", "多少钱出"]
        self.sensitive_keywords = ["赔", "退款", "纠纷", "进水", "损坏", "投诉", "申诉", "线下", "微信"]
        self.schedule_keywords = ["档期", "租", "可租", "哪天", "发货", "到货", "顺丰", "陆运", "快递"]
        self.city_keywords = ["上海", "北京", "深圳", "广州", "杭州", "苏州", "成都", "重庆", "武汉", "西安", "南京", "天津", "长沙"]

    def get_reply_mode(self) -> str:
        return self.repository.get_config("REPLY_MODE_DEFAULT", "faq_strict") or "faq_strict"

    def xiaohongshu_enabled(self) -> bool:
        return (self.repository.get_config("XIAOHONGSHU_ENABLED", "False") or "False").strip().lower() == "true"

    def build_xiaohongshu_keyword(self, model_code: Optional[str], user_message: str) -> str:
        return " ".join([part for part in [model_code, user_message, "小红书"] if part]).strip()

    def build_xiaohongshu_hint(self, model_code: Optional[str], user_message: str) -> str:
        keyword = self.build_xiaohongshu_keyword(model_code, user_message)
        return f"如需我也可以给您发小红书参考，关键词：{keyword}"

    def should_offer_xiaohongshu(self, user_message: str, has_knowledge: bool) -> bool:
        text = user_message.lower()
        if has_knowledge:
            return False
        keywords = ["教程", "评测", "实拍", "攻略", "开箱", "对比", "小红书"]
        return any(keyword in text for keyword in keywords)

    def detect_model_code(self, item_description: str, item_id: Optional[str] = None) -> Optional[str]:
        return self.learning_service.infer_model_code(item_description, item_id=item_id)

    def detect_city(self, message: str) -> Optional[str]:
        for keyword in self.city_keywords:
            if keyword in message:
                return keyword
        return None

    def parse_date_range(self, message: str) -> Tuple[Optional[str], Optional[str]]:
        current_year = datetime.now().year
        matches = re.findall(r"(\d{1,2})[月/-](\d{1,2})[日号]?", message)
        if not matches:
            iso_matches = re.findall(r"(20\d{2}-\d{1,2}-\d{1,2})", message)
            if len(iso_matches) >= 2:
                return iso_matches[0], iso_matches[1]
            return None, None
        dates = []
        for month, day in matches[:2]:
            dates.append(f"{current_year}-{int(month):02d}-{int(day):02d}")
        if len(dates) == 1:
            return dates[0], dates[0]
        if len(dates) >= 2:
            return dates[0], dates[1]
        return None, None

    def is_bargain(self, message: str) -> bool:
        text = message.lower()
        return any(keyword in text for keyword in self.bargain_keywords)

    def is_sensitive(self, message: str) -> bool:
        text = message.lower()
        return any(keyword in text for keyword in self.sensitive_keywords)

    def is_schedule_query(self, message: str) -> bool:
        return any(keyword in message for keyword in self.schedule_keywords)

    def is_functional_question(self, message: str) -> bool:
        """检测功能性/技术性问题（需要联网查询后人工确认）。"""
        return any(keyword in message for keyword in FUNCTIONAL_KEYWORDS)

    def handle_pre_reply(
        self,
        session_id: str,
        item_id: Optional[str],
        item_description: str,
        user_message: str,
        context: List[Dict],
        has_knowledge: bool,
    ) -> Dict:
        model_code = self.detect_model_code(item_description, item_id=item_id)
        if self.is_bargain(user_message):
            task = self.takeover_service.create_and_notify(session_id, item_id, model_code, user_message, "bargain_or_change_price", "high")
            return {
                "action": "takeover",
                "task": task,
                "reply_text": "宝稍等 我马上就来",
                "model_code": model_code,
            }

        if self.is_sensitive(user_message):
            task = self.takeover_service.create_and_notify(session_id, item_id, model_code, user_message, "sensitive_after_sale", "high")
            return {
                "action": "takeover",
                "task": task,
                "reply_text": "宝稍等 我马上就来",
                "model_code": model_code,
            }

        if self.is_schedule_query(user_message):
            start_date, end_date = self.parse_date_range(user_message)
            city = self.detect_city(user_message)
            if not start_date or not end_date:
                return {
                    "action": "ask_followup",
                    "reply_text": "麻烦发下具体租期日期，我先帮您查档期。",
                    "model_code": model_code,
                }
            availability = self.schedule_service.check_availability(model_code or "UNKNOWN", start_date, end_date, city)
            if city is None:
                return {
                    "action": "ask_followup",
                    "reply_text": f"{availability['reason'] or '可以先查档期'}，麻烦再发下收货城市。",
                    "model_code": model_code,
                    "availability": availability,
                }
            if availability["available"]:
                first = availability["availableUnits"][0]
                return {
                    "action": "reply",
                    "reply_text": f"这边可安排，{first['unitCode']} 可出，预计 {first['plannedShipAt'][:10]} 发，{first['expectedArriveAt'][:10]} 前到。",
                    "model_code": model_code,
                    "availability": availability,
                }
            return {
                "action": "takeover",
                "task": self.takeover_service.create_and_notify(session_id, item_id, model_code, user_message, "schedule_unavailable", "normal"),
                "model_code": model_code,
                "availability": availability,
            }

        reply_mode = self.get_reply_mode()
        if reply_mode == "faq_strict" and not has_knowledge:            # 功能性问题 → web search + 飞书确认后再回复
            if self.is_functional_question(user_message):
                return {
                    "action": "feishu_confirm",
                    "reply_text": "宝稍等 我马上赶来",
                    "reply_type": "functional_search",
                    "model_code": model_code,
                    "user_question": user_message,
                }
            # 非功能性问题 → 飞书通知 + 默认回复（只回复一次）
            task = self.takeover_service.create_and_notify(session_id, item_id, model_code, user_message, "faq_miss", "normal")
            return {
                "action": "takeover",
                "task": task,
                "reply_text": "宝稍等 我马上就来",
                "model_code": model_code,
            }

        return {
            "action": "continue",
            "model_code": model_code,
            "reply_mode": reply_mode,
        }
