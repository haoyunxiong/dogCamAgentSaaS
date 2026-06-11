from typing import Dict, Optional

from .notification_service import NotificationService
from .rental_repository import RentalRepository
from .schedule_service import ScheduleService


class OrderService:
    def __init__(self, repository: RentalRepository, schedule_service: ScheduleService, notifier: NotificationService):
        self.repository = repository
        self.schedule_service = schedule_service
        self.notifier = notifier

    def create_order_and_lock(self, payload: Dict) -> Dict:
        if not payload.get("unit_id"):
            availability = self.schedule_service.check_availability(
                payload["model_code"],
                payload["rent_start_date"],
                payload["rent_end_date"],
                payload.get("city"),
                payload.get("shipping_mode"),
            )
            payload["unit_id"] = availability.get("recommendedUnitId")
            payload.setdefault("planned_ship_at", availability.get("shipping", {}).get("planned_ship_at"))
            payload.setdefault("expected_arrive_at", availability.get("shipping", {}).get("expected_arrive_at"))
        else:
            shipping = self.schedule_service.calculate_ship_plan(
                payload["rent_start_date"], payload.get("city"), payload.get("shipping_mode")
            )
            payload.setdefault("planned_ship_at", shipping["planned_ship_at"])
            payload.setdefault("expected_arrive_at", shipping["expected_arrive_at"])

        order_id = self.repository.create_order(payload)
        self.schedule_service.build_schedule_blocks(
            order_id=order_id,
            model_code=payload["model_code"],
            unit_id=payload["unit_id"],
            rent_start_date=payload["rent_start_date"],
            rent_end_date=payload["rent_end_date"],
            planned_ship_at=payload["planned_ship_at"],
            expected_arrive_at=payload["expected_arrive_at"],
        )
        if payload.get("tracking_no"):
            self.repository.create_shipping_record(
                {
                    "order_id": order_id,
                    "tracking_no": payload.get("tracking_no"),
                    "shipping_mode": payload.get("shipping_mode"),
                    "latest_status": payload.get("latest_logistics_status"),
                    "ship_to_city": payload.get("city"),
                    "planned_ship_at": payload.get("planned_ship_at"),
                    "expected_arrive_at": payload.get("expected_arrive_at"),
                }
            )
        self.notifier.notify_order(
            {
                "type": "order_created",
                "orderId": order_id,
                "modelCode": payload.get("model_code"),
                "unitId": payload.get("unit_id"),
                "rentRange": f"{payload.get('rent_start_date')} ~ {payload.get('rent_end_date')}",
                "fee": payload.get("fee", 0),
                "address": payload.get("address"),
                "plannedShipAt": payload.get("planned_ship_at"),
                "trackingNo": payload.get("tracking_no"),
            }
        )
        return {"orderId": order_id, "unitId": payload.get("unit_id"), "plannedShipAt": payload.get("planned_ship_at")}

    def update_shipping(self, order_id: int, tracking_no: Optional[str], shipping_mode: Optional[str], latest_status: Optional[str]):
        self.repository.update_order_shipping(order_id, tracking_no, shipping_mode, latest_status)
        self.notifier.notify_order(
            {
                "type": "shipping_updated",
                "orderId": order_id,
                "trackingNo": tracking_no,
                "shippingMode": shipping_mode,
                "latestStatus": latest_status,
            }
        )
