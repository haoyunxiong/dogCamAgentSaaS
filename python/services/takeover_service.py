from datetime import datetime, timedelta
from typing import Dict, Optional

from .notification_service import NotificationService
from .rental_repository import RentalRepository


class TakeoverService:
    def __init__(self, repository: RentalRepository, notifier: NotificationService):
        self.repository = repository
        self.notifier = notifier

    def create_and_notify(
        self,
        session_id: str,
        item_id: Optional[str],
        model_code: Optional[str],
        latest_question: str,
        reason: str,
        priority: str = "normal",
    ) -> Dict:
        task_id = self.repository.create_takeover_task(session_id, item_id, model_code, latest_question, reason, priority)
        task = self.repository.get_takeover_task(task_id)
        self.notifier.notify_takeover(task)
        self.repository.mark_takeover_notified(task_id)
        return self.repository.get_takeover_task(task_id)

    def check_timeouts(self) -> int:
        timeout_sec = int(self.repository.get_config("MANUAL_TAKEOVER_TIMEOUT_SEC", "180") or "180")
        escalated = 0
        now = datetime.now()
        for task in self.repository.list_pending_takeovers():
            notified_at = task.get("notified_at") or task.get("created_at")
            if not notified_at:
                continue
            try:
                ts = datetime.fromisoformat(str(notified_at).replace("Z", "+00:00").replace(" ", "T"))
            except ValueError:
                continue
            if now - ts < timedelta(seconds=timeout_sec):
                continue
            if self.notifier.notify_phone_escalation(task):
                self.repository.mark_takeover_escalated(task["id"])
                escalated += 1
        return escalated
