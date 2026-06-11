from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from .rental_repository import RentalRepository


class ScheduleService:
    def __init__(self, repository: RentalRepository):
        self.repository = repository

    def estimate_eta_days(self, city: Optional[str], shipping_mode: Optional[str] = None) -> float:
        shipping_mode = shipping_mode or "land"
        if shipping_mode == "next_morning":
            return 1.0
        if shipping_mode == "express":
            return 1.5
        if not city:
            return 2.5
        remote_keywords = ["新疆", "西藏", "青海", "甘肃", "内蒙古", "海南", "宁夏", "黑龙江"]
        if any(keyword in city for keyword in remote_keywords):
            return 4.0
        return 2.0

    def calculate_ship_plan(self, rent_start_date: str, city: Optional[str], shipping_mode: Optional[str] = None) -> Dict[str, str]:
        start = datetime.fromisoformat(rent_start_date)
        eta_days = self.estimate_eta_days(city, shipping_mode)
        arrive_at = start - timedelta(days=1)
        planned_ship_at = arrive_at - timedelta(days=eta_days)
        return {
            "planned_ship_at": planned_ship_at.isoformat(timespec="seconds"),
            "expected_arrive_at": arrive_at.isoformat(timespec="seconds"),
            "eta_days": eta_days,
        }

    def check_availability(
        self,
        model_code: str,
        rent_start_date: str,
        rent_end_date: str,
        city: Optional[str] = None,
        shipping_mode: Optional[str] = None,
    ) -> Dict[str, Any]:
        units = self.repository.list_units_by_model(model_code)
        blocks = self.repository.list_overlapping_blocks(model_code, rent_start_date, rent_end_date)
        blocked_unit_ids = {block.get("unit_id") for block in blocks if block.get("unit_id")}
        ship_plan = self.calculate_ship_plan(rent_start_date, city, shipping_mode)

        available_units: List[Dict[str, Any]] = []
        for unit in units:
            if unit["id"] in blocked_unit_ids:
                continue
            available_units.append(
                {
                    "unitId": unit["id"],
                    "unitCode": unit["unit_code"],
                    "canShipOnTime": True,
                    "plannedShipAt": ship_plan["planned_ship_at"],
                    "expectedArriveAt": ship_plan["expected_arrive_at"],
                }
            )

        reason = None
        if not available_units:
            reason = "该型号在所选日期没有空闲档期"
        elif city is None:
            reason = "档期可排，但建议先确认城市/地址判断顺丰时效"

        return {
            "available": bool(available_units),
            "recommendedUnitId": available_units[0]["unitId"] if available_units else None,
            "availableUnits": available_units,
            "reason": reason,
            "shipping": ship_plan,
        }

    def build_schedule_blocks(self, order_id: int, model_code: str, unit_id: int, rent_start_date: str, rent_end_date: str, planned_ship_at: str, expected_arrive_at: str):
        ship_day = planned_ship_at.split("T")[0]
        arrive_day = expected_arrive_at.split("T")[0]
        end_dt = datetime.fromisoformat(rent_end_date) + timedelta(days=2)
        buffer_end = end_dt.date().isoformat()
        self.repository.create_schedule_block(
            {
                "unit_id": unit_id,
                "order_id": order_id,
                "model_code": model_code,
                "block_type": "shipping",
                "start_date": ship_day,
                "end_date": arrive_day,
                "planned_ship_at": planned_ship_at,
                "expected_arrive_at": expected_arrive_at,
                "note": "租赁发货占用",
            }
        )
        self.repository.create_schedule_block(
            {
                "unit_id": unit_id,
                "order_id": order_id,
                "model_code": model_code,
                "block_type": "rent",
                "start_date": rent_start_date,
                "end_date": rent_end_date,
                "planned_ship_at": planned_ship_at,
                "expected_arrive_at": expected_arrive_at,
                "note": "租期占用",
            }
        )
        self.repository.create_schedule_block(
            {
                "unit_id": unit_id,
                "order_id": order_id,
                "model_code": model_code,
                "block_type": "buffer",
                "start_date": rent_end_date,
                "end_date": buffer_end,
                "note": "归还缓冲",
            }
        )
