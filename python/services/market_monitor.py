"""
market_monitor.py — 闲鱼市场监控服务

两种模式：
1. Browser 模式：通过 Playwright CDP 在闲鱼搜索页面爬取帖子（不调接口）
2. API 模式：通过闲鱼搜索接口获取帖子列表（Cookie 调用）

功能：
- 定时扫描指定机型的非租赁帖子
- 记录价格、数量变化
- 生成价格趋势和异动告警
"""

import asyncio
import json
import re
import pymysql
from mysql_helper import get_sqlite_like_connection
import statistics
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from loguru import logger


class MarketMonitorStore:
    """市场快照数据存取（与 Electron dbManager 共享同一 DB）。"""

    def __init__(self, db_path: str = None):
        self.db_path = db_path  # kept for compatibility

    @contextmanager
    def conn(self):
        c = get_sqlite_like_connection()
        try:
            yield c
            c.commit()
        finally:
            c.close()

    def save_snapshot(self, model_code: str, listings: List[Dict]) -> int:
        prices = [l["price"] for l in listings if l.get("price") and l["price"] > 0]
        avg_price = statistics.mean(prices) if prices else 0
        min_price = min(prices) if prices else 0
        max_price = max(prices) if prices else 0
        median_price = statistics.median(prices) if prices else 0

        # 价格区间分布
        bands = {}
        for p in prices:
            band = f"{int(p // 500) * 500}-{int(p // 500) * 500 + 499}"
            bands[band] = bands.get(band, 0) + 1

        # 检测已售出的帖子
        sold_count = sum(1 for l in listings if l.get("status") == "sold")

        with self.conn() as c:
            cur = c.execute(
                """
                INSERT INTO market_snapshots (
                    model_code, snapshot_time, total_listings, avg_price, min_price,
                    max_price, median_price, sold_count, price_band_json, source, created_at
                ) VALUES (%s, NOW(), %s, %s, %s, %s, %s, %s, %s, 'xianyu', NOW())
                """,
                (model_code, len(listings), avg_price, min_price, max_price,
                 median_price, sold_count, json.dumps(bands, ensure_ascii=False)),
            )
            snapshot_id = cur.lastrowid

            # 保存每条帖子
            for item in listings:
                c.execute(
                    """
                    INSERT INTO market_listings (
                        snapshot_id, model_code, listing_id, title, price,
                        seller_name, location, is_rental, status,
                        first_seen_at, last_seen_at, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW(), NOW())
                    """,
                    (snapshot_id, model_code, item.get("listing_id", ""),
                     item.get("title", ""), item.get("price", 0),
                     item.get("seller_name", ""), item.get("location", ""),
                     1 if item.get("is_rental") else 0,
                     item.get("status", "active")),
                )

            return snapshot_id

    def get_previous_snapshot(self, model_code: str) -> Optional[Dict]:
        with self.conn() as c:
            row = c.execute(
                "SELECT * FROM market_snapshots WHERE model_code = %s ORDER BY snapshot_time DESC LIMIT 1 OFFSET 1",
                (model_code,),
            ).fetchone()
            return dict(row) if row else None

    def detect_anomaly(self, model_code: str) -> Optional[Dict]:
        """检测价格/数量异动"""
        with self.conn() as c:
            latest = c.execute(
                "SELECT * FROM market_snapshots WHERE model_code = %s ORDER BY snapshot_time DESC LIMIT 1",
                (model_code,),
            ).fetchone()
            baseline = c.execute(
                """
                SELECT AVG(avg_price) as avg_price, AVG(total_listings) as avg_listings
                FROM market_snapshots
                WHERE model_code = %s AND snapshot_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                  AND snapshot_time < DATE_SUB(NOW(), INTERVAL 1 DAY)
                """,
                (model_code,),
            ).fetchone()

            if not latest or not baseline or not baseline["avg_price"]:
                return None

            price_change = (latest["avg_price"] - baseline["avg_price"]) / baseline["avg_price"] * 100
            listing_change = 0
            if baseline["avg_listings"]:
                listing_change = (latest["total_listings"] - baseline["avg_listings"]) / baseline["avg_listings"] * 100

            # 超过 10% 变动则告警
            alerts = []
            if abs(price_change) > 10:
                direction = "上涨" if price_change > 0 else "下跌"
                alerts.append(f"价格{direction} {abs(price_change):.1f}%")
            if abs(listing_change) > 20:
                direction = "增加" if listing_change > 0 else "减少"
                alerts.append(f"帖子数{direction} {abs(listing_change):.1f}%")

            if not alerts:
                return None

            return {
                "model_code": model_code,
                "alert_message": "，".join(alerts),
                "current_price": latest["avg_price"],
                "baseline_price": baseline["avg_price"],
                "price_change_pct": round(price_change, 1),
                "current_listings": latest["total_listings"],
                "listing_change_pct": round(listing_change, 1),
            }


# ═══════════════════════════════════════════════════════════════════════════
# Browser 模式扫描器（通过 Playwright CDP 搜索闲鱼页面）
# ═══════════════════════════════════════════════════════════════════════════

SEARCH_PAGE_SCRIPT = r'''
(keyword) => {
  const results = [];
  const cards = document.querySelectorAll('[class*="item"], [class*="card"], [class*="feed"]');
  for (const card of cards) {
    const titleEl = card.querySelector('[class*="title"], h3, h2');
    const priceEl = card.querySelector('[class*="price"]');
    const locationEl = card.querySelector('[class*="location"], [class*="area"]');
    const sellerEl = card.querySelector('[class*="seller"], [class*="nick"]');

    const title = (titleEl?.innerText || '').trim();
    const priceText = (priceEl?.innerText || '').replace(/[^0-9.]/g, '');
    const price = parseFloat(priceText) || 0;

    if (!title || price <= 0) continue;

    // 排除租赁帖子
    const isRental = /租|日租|月租|出租|短租/.test(title);

    results.push({
      title,
      price,
      listing_id: card.getAttribute('data-id') || card.querySelector('a')?.href?.match(/id=(\d+)/)?.[1] || `${Date.now()}_${results.length}`,
      seller_name: (sellerEl?.innerText || '').trim(),
      location: (locationEl?.innerText || '').trim(),
      is_rental: isRental,
      status: 'active',
    });
  }
  return results;
}
'''


class MarketMonitorBrowser:
    """通过浏览器 CDP 扫描闲鱼搜索结果。"""

    def __init__(self, store: MarketMonitorStore, config: dict):
        self.store = store
        self.config = config
        self.search_keywords = self._build_keywords()

    def _build_keywords(self) -> Dict[str, str]:
        """从配置获取监控的机型关键词映射。"""
        raw = self.config.get("MARKET_MONITOR_KEYWORDS", "")
        if not raw:
            return {}
        result = {}
        for line in raw.strip().split("\n"):
            parts = line.split(":", 1) if ":" in line else line.split("=", 1)
            if len(parts) == 2:
                result[parts[0].strip()] = parts[1].strip()
        return result

    async def scan_all(self, on_progress: Optional[Callable] = None):
        """扫描所有配置的机型。"""
        from login_browser import build_browser_runtime_options, ensure_debug_browser, get_debug_http_base

        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.error("[market] Playwright 未安装")
            return []

        browser_options = build_browser_runtime_options(self.config)
        port = browser_options["port"]
        ensure_debug_browser(
            port=port,
            reuse_existing=browser_options["reuse_existing"],
            auto_launch=browser_options["auto_launch"],
        )

        results = []
        async with async_playwright() as pw:
            browser = await pw.chromium.connect_over_cdp(f"http://localhost:{port}")
            context = browser.contexts[0] if browser.contexts else await browser.new_context()

            for model_code, keyword in self.search_keywords.items():
                if on_progress:
                    on_progress(f"正在扫描: {model_code} ({keyword})")
                try:
                    page = await context.new_page()
                    search_url = f"https://www.goofish.com/search?q={keyword}"
                    await page.goto(search_url, wait_until="domcontentloaded", timeout=15000)
                    await asyncio.sleep(3)  # 等待动态加载

                    listings = await page.evaluate(SEARCH_PAGE_SCRIPT, keyword)
                    for item in listings:
                        item["model_code"] = model_code

                    snapshot_id = self.store.save_snapshot(model_code, listings)
                    anomaly = self.store.detect_anomaly(model_code)

                    results.append({
                        "model_code": model_code,
                        "count": len(listings),
                        "snapshot_id": snapshot_id,
                        "anomaly": anomaly,
                    })

                    logger.info(f"[market] {model_code}: {len(listings)} 条帖子")
                    await page.close()

                except Exception as e:
                    logger.error(f"[market] 扫描 {model_code} 失败: {e}")
                    results.append({"model_code": model_code, "error": str(e)})

        return results


# ═══════════════════════════════════════════════════════════════════════════
# API 模式扫描器（通过闲鱼搜索接口）
# ═══════════════════════════════════════════════════════════════════════════

class MarketMonitorAPI:
    """通过闲鱼搜索 API 扫描市场数据。"""

    def __init__(self, store: MarketMonitorStore, config: dict, xianyu_api=None):
        self.store = store
        self.config = config
        self.xianyu_api = xianyu_api
        self.search_keywords = self._build_keywords()

    def _build_keywords(self) -> Dict[str, str]:
        raw = self.config.get("MARKET_MONITOR_KEYWORDS", "")
        if not raw:
            return {}
        result = {}
        for line in raw.strip().split("\n"):
            parts = line.split(":", 1) if ":" in line else line.split("=", 1)
            if len(parts) == 2:
                result[parts[0].strip()] = parts[1].strip()
        return result

    async def scan_all(self, on_progress: Optional[Callable] = None) -> List[Dict]:
        """通过 API 扫描所有配置的机型。"""
        import requests

        cookies_str = self.config.get("COOKIES_STR", "")
        if not cookies_str:
            logger.warning("[market-api] 无 Cookie，跳过扫描")
            return []

        results = []
        for model_code, keyword in self.search_keywords.items():
            if on_progress:
                on_progress(f"正在扫描: {model_code} ({keyword})")
            try:
                listings = await asyncio.to_thread(
                    self._search_keyword, keyword, model_code, cookies_str
                )
                snapshot_id = self.store.save_snapshot(model_code, listings)
                anomaly = self.store.detect_anomaly(model_code)
                results.append({
                    "model_code": model_code,
                    "count": len(listings),
                    "snapshot_id": snapshot_id,
                    "anomaly": anomaly,
                })
                logger.info(f"[market-api] {model_code}: {len(listings)} 条帖子")
            except Exception as e:
                logger.error(f"[market-api] 扫描 {model_code} 失败: {e}")
                results.append({"model_code": model_code, "error": str(e)})

        return results

    def _search_keyword(self, keyword: str, model_code: str, cookies_str: str) -> List[Dict]:
        """调用闲鱼搜索接口获取帖子列表。"""
        import requests
        from utils.xianyu_utils import parse_cookies_str

        cookies = parse_cookies_str(cookies_str)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.goofish.com/",
            "Cookie": cookies_str,
        }

        # 闲鱼搜索 API（后续可替换为官方接口）
        search_url = "https://h5api.m.goofish.com/h5/mtop.taobao.idlemtopsearch.search/1.0/"
        params = {
            "data": json.dumps({"keyword": keyword, "pageNumber": 1, "pageSize": 50}),
        }

        try:
            resp = requests.get(search_url, headers=headers, params=params, timeout=10)
            data = resp.json()
        except Exception as e:
            logger.warning(f"[market-api] 搜索请求失败: {e}")
            return []

        items = []
        result_list = (
            data.get("data", {}).get("resultList", [])
            or data.get("data", {}).get("items", [])
            or []
        )
        for item in result_list:
            title = item.get("title", "")
            price = float(item.get("price", 0) or 0) / 100
            is_rental = bool(re.search(r"租|日租|月租|出租|短租", title))

            items.append({
                "listing_id": item.get("id", ""),
                "title": title,
                "price": price,
                "seller_name": item.get("sellerNick", ""),
                "location": item.get("area", ""),
                "is_rental": is_rental,
                "model_code": model_code,
                "status": "sold" if item.get("sold") else "active",
            })

        return items


# ═══════════════════════════════════════════════════════════════════════════
# 定时调度
# ═══════════════════════════════════════════════════════════════════════════

class MarketScheduler:
    """定时市场扫描调度器。"""

    def __init__(self, monitor, notify_fn: Optional[Callable] = None):
        self.monitor = monitor
        self.notify_fn = notify_fn
        self._task: Optional[asyncio.Task] = None

    async def run_loop(self, interval_seconds: int = 3600):
        """每 interval_seconds 扫描一次。"""
        logger.info(f"[market-scheduler] 启动定时扫描，间隔 {interval_seconds}s")
        while True:
            try:
                results = await self.monitor.scan_all()
                for r in results:
                    anomaly = r.get("anomaly")
                    if anomaly and self.notify_fn:
                        self.notify_fn(anomaly)
            except Exception as e:
                logger.error(f"[market-scheduler] 扫描异常: {e}")
            await asyncio.sleep(interval_seconds)

    def start(self, interval_seconds: int = 3600):
        self._task = asyncio.create_task(self.run_loop(interval_seconds))

    def stop(self):
        if self._task:
            self._task.cancel()
