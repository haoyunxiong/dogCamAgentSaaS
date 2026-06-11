"""
SfDeliveryService · 顺丰时效估算（Sprint 3 mock 版）

第一版使用规则估算，留 interface 供 Sprint 4 接入真实顺丰开放接口。
返回内容能直接拼成给买家看的话术。
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional


# 偏远地区默认 72h
REMOTE_KEYWORDS = ("新疆", "西藏", "青海", "甘肃", "内蒙古", "海南", "宁夏", "黑龙江", "吉林")
# 主流同城快 24h
SAME_CITY = ("上海", "北京", "深圳", "广州", "杭州", "苏州", "南京")


@dataclass
class DeliveryEstimate:
    carrier: str                 # sf | sf_cold | self_pickup
    eta_hours: int
    eta_text: str                # "今天下午 / 明天上午 / 后天"
    arrive_at: Optional[str]     # ISO
    ship_deadline: Optional[str] # 今天几点前下单能发
    note: str                    # 调试用


class SfDeliveryService:
    """顺丰时效估算（mock）。实际接口接入放 Sprint 4。"""

    def __init__(self, ship_from_city: str = "上海"):
        self.ship_from_city = ship_from_city

    def estimate(
        self,
        ship_to_city: Optional[str],
        shipping_mode: Optional[str] = None,
        now: Optional[datetime] = None,
    ) -> DeliveryEstimate:
        now = now or datetime.now()
        carrier = "sf"
        if shipping_mode == "sf_cold":
            carrier = "sf_cold"
        elif shipping_mode == "self_pickup":
            return DeliveryEstimate(
                carrier="self_pickup", eta_hours=0,
                eta_text="自取",
                arrive_at=now.isoformat(timespec="minutes"),
                ship_deadline=None,
                note="buyer_pickup",
            )

        city = ship_to_city or ""
        if any(k in city for k in REMOTE_KEYWORDS):
            eta_hours = 72
            eta_text = "大约 3 天"
        elif any(k in city for k in SAME_CITY) and self.ship_from_city in SAME_CITY:
            # 同城或邻近一线
            if city == self.ship_from_city:
                eta_hours = 10
                eta_text = "今天下午或晚上到" if now.hour < 14 else "明天上午到"
            else:
                eta_hours = 24
                eta_text = "明天到"
        elif not city:
            eta_hours = 48
            eta_text = "大约 2 天"
        else:
            eta_hours = 36
            eta_text = "一般 1-2 天"

        ship_deadline = None
        if now.hour < 17:
            ship_deadline = now.replace(hour=17, minute=0, second=0, microsecond=0).isoformat(timespec="minutes")
        arrive_dt = now + timedelta(hours=eta_hours)
        return DeliveryEstimate(
            carrier=carrier,
            eta_hours=eta_hours,
            eta_text=eta_text,
            arrive_at=arrive_dt.isoformat(timespec="minutes"),
            ship_deadline=ship_deadline,
            note=f"from={self.ship_from_city} to={city or 'UNKNOWN'}",
        )
