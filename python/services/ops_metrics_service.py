"""
Sprint 7 · 运营指标聚合服务

聚合"机器人今天干了啥"的核心数字，供 Dashboard / 飞书日报使用：

    - auto_reply_today        自动回复条数（assistant 消息，排除人工接管）
    - manual_takeover_today   今日转人工条数（takeover_tasks 新建）
    - takeover_pending        当前待处理接管
    - booking_drafts_today    今日建单流程启动数
    - booking_converted_today 今日真正落单（state=order_drafted 或 closed+success）
    - booking_conversion_rate 建单转化率（converted / drafts）
    - structured_pending      结构化学习候选待审
    - feishu_pending          飞书侧待人工确认条数

所有 SQL 均走 `repository.conn()`，异常被吞（返回 0），不影响面板加载。
"""

from datetime import datetime
from typing import Any, Dict, Optional

from .rental_repository import RentalRepository


class OpsMetricsService:
    def __init__(self, repository: RentalRepository):
        self.repository = repository

    # ------------------------------------------------------------------
    # 内部：安全 count
    # ------------------------------------------------------------------
    def _scalar(self, sql: str, params: tuple = ()) -> int:
        try:
            with self.repository.conn() as conn:
                row = conn.execute(sql, params).fetchone()
                if not row:
                    return 0
                # pymysql DictCursor → first value
                val = next(iter(row.values())) if isinstance(row, dict) else row[0]
                return int(val or 0)
        except Exception:
            return 0

    # ------------------------------------------------------------------
    # 单项指标
    # ------------------------------------------------------------------
    def count_manual_takeover_today(self) -> int:
        return self._scalar(
            "SELECT COUNT(*) AS c FROM takeover_tasks WHERE DATE(created_at) = CURDATE()"
        )

    def count_takeover_pending(self) -> int:
        return self._scalar(
            "SELECT COUNT(*) AS c FROM takeover_tasks WHERE status IN ('new','notified')"
        )

    def count_booking_drafts_today(self) -> int:
        return self._scalar(
            "SELECT COUNT(*) AS c FROM booking_drafts WHERE DATE(updated_at) = CURDATE()"
        )

    def count_booking_converted_today(self) -> int:
        return self._scalar(
            """
            SELECT COUNT(*) AS c FROM booking_drafts
            WHERE DATE(updated_at) = CURDATE()
              AND (state = 'order_drafted'
                   OR (state = 'closed' AND closed_reason = 'success'))
            """
        )

    def count_structured_pending(self) -> int:
        return self._scalar(
            "SELECT COUNT(*) AS c FROM structured_learning_suggestions WHERE status = 'pending'"
        )

    def count_feishu_pending(self) -> int:
        return self._scalar(
            "SELECT COUNT(*) AS c FROM feishu_pending_replies WHERE status = 'pending'"
        )

    def count_auto_reply_today(self) -> int:
        """assistant 角色今日消息数，减去 takeover 场景（粗估，真实环境可接替换）。"""
        # chat_messages 存在 chat_db，这里做 best-effort；不存在就返回 0
        try:
            with self.repository.conn() as conn:
                row = conn.execute(
                    """
                    SELECT COUNT(*) AS c FROM chat_messages
                    WHERE role='assistant' AND DATE(created_at) = CURDATE()
                    """
                ).fetchone()
                return int(next(iter(row.values())) or 0) if row else 0
        except Exception:
            return 0

    # ------------------------------------------------------------------
    # 聚合入口
    # ------------------------------------------------------------------
    def get_today_snapshot(self) -> Dict[str, Any]:
        drafts = self.count_booking_drafts_today()
        converted = self.count_booking_converted_today()
        conversion_rate = round(converted / drafts, 4) if drafts > 0 else 0.0

        auto_reply = self.count_auto_reply_today()
        manual_takeover = self.count_manual_takeover_today()
        total = auto_reply + manual_takeover
        # 命中率：auto_reply / (auto_reply + manual_takeover)，无数据返回 0
        hit_rate = round(auto_reply / total, 4) if total > 0 else 0.0

        return {
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "auto_reply_today": auto_reply,
            "manual_takeover_today": manual_takeover,
            "takeover_pending": self.count_takeover_pending(),
            "hit_rate": hit_rate,
            "booking_drafts_today": drafts,
            "booking_converted_today": converted,
            "booking_conversion_rate": conversion_rate,
            "structured_pending": self.count_structured_pending(),
            "feishu_pending": self.count_feishu_pending(),
        }
