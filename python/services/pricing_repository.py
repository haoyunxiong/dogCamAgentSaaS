"""
PricingRepository · 租赁价格分档（Sprint 3）

表结构：
    rental_pricing(id, model_code, min_days, max_days, daily_price, total_price, deposit, remark, active)

查询策略：按租期天数落到对应区间，找最匹配的 active=1 条目。
首次调用时自动建表。
"""

from typing import Any, Dict, List, Optional

from .rental_repository import RentalRepository


_PRICING_DDL = """
    CREATE TABLE IF NOT EXISTS rental_pricing (
      id INT AUTO_INCREMENT PRIMARY KEY,
      model_code VARCHAR(100) NOT NULL,
      min_days INT NOT NULL,
      max_days INT NOT NULL,
      daily_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NULL,
      deposit DECIMAL(10,2) NOT NULL DEFAULT 0,
      remark VARCHAR(255),
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pricing_model (model_code, active)
    ) ENGINE=InnoDB
"""


class PricingRepository:
    _ensured = False

    def __init__(self, repository: RentalRepository):
        self.repository = repository

    def _ensure(self, conn) -> None:
        if PricingRepository._ensured:
            return
        try:
            conn.execute(_PRICING_DDL)
            try:
                columns = conn.execute("SHOW COLUMNS FROM rental_pricing").fetchall()
                column_names = {row.get("Field") for row in columns if isinstance(row, dict)}
                if "total_price" not in column_names:
                    conn.execute("ALTER TABLE rental_pricing ADD COLUMN total_price DECIMAL(10,2) NULL AFTER daily_price")
            except Exception:
                pass
            PricingRepository._ensured = True
        except Exception:
            pass

    # ---- 查询 ----

    def find_price(self, model_code: str, days: int) -> Optional[Dict[str, Any]]:
        if not model_code or days <= 0:
            return None
        try:
            with self.repository.conn() as conn:
                self._ensure(conn)
                row = conn.execute(
                    """
                    SELECT id, model_code, min_days, max_days, daily_price, total_price, deposit, remark
                    FROM rental_pricing
                    WHERE model_code = %s AND active = 1
                      AND min_days <= %s AND max_days >= %s
                    ORDER BY (max_days - min_days) ASC, id ASC
                    LIMIT 1
                    """,
                    (model_code, days, days),
                ).fetchone()
                return dict(row) if row else None
        except Exception:
            return None

    def list_prices(self, model_code: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            with self.repository.conn() as conn:
                self._ensure(conn)
                if model_code:
                    rows = conn.execute(
                        "SELECT * FROM rental_pricing WHERE model_code = %s ORDER BY min_days ASC",
                        (model_code,),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        "SELECT * FROM rental_pricing ORDER BY model_code, min_days ASC"
                    ).fetchall()
                return [dict(r) for r in rows]
        except Exception:
            return []

    # ---- 维护 ----

    def upsert_price(
        self,
        model_code: str,
        min_days: int,
        max_days: int,
        daily_price: float,
        total_price: Optional[float] = None,
        deposit: float = 0,
        remark: Optional[str] = None,
        active: int = 1,
        row_id: Optional[int] = None,
    ) -> int:
        with self.repository.conn() as conn:
            self._ensure(conn)
            if row_id:
                conn.execute(
                    """
                    UPDATE rental_pricing
                    SET model_code=%s, min_days=%s, max_days=%s, daily_price=%s, total_price=%s,
                        deposit=%s, remark=%s, active=%s, updated_at=CURRENT_TIMESTAMP
                    WHERE id=%s
                    """,
                    (model_code, min_days, max_days, daily_price, total_price, deposit, remark, active, row_id),
                )
                return row_id
            cur = conn.execute(
                """
                INSERT INTO rental_pricing
                    (model_code, min_days, max_days, daily_price, total_price, deposit, remark, active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (model_code, min_days, max_days, daily_price, total_price, deposit, remark, active),
            )
            return cur.lastrowid

    def delete_price(self, row_id: int) -> None:
        with self.repository.conn() as conn:
            self._ensure(conn)
            conn.execute("DELETE FROM rental_pricing WHERE id=%s", (row_id,))
