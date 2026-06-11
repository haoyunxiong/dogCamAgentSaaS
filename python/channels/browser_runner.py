import asyncio
import random
import re
import time
from typing import Optional, Dict, List

from loguru import logger

from XianyuApis import XianyuApis
from runtime import ConversationProcessor, InboundChatEvent
from services import LearningService, NotificationService, RentalAgentService, RentalRepository, ScheduleService, SessionStateService, TakeoverService
from services.intent_router import IntentRouter
from services.pricing_repository import PricingRepository
from services.sf_delivery_service import SfDeliveryService
from services.quote_service import QuoteService
from services.booking_service import BookingService
from login_browser import (
    _extract_cookie_str,
    browser_mode_summary,
    build_browser_runtime_options,
    ensure_debug_browser,
    extract_cookies_from_cookie_header,
    get_debug_http_base,
    get_xianyu_im_url,
    has_login_cookie,
)


SCAN_PAGE_SCRIPT = r'''
() => {
  const norm = (value) => (value || '').replace(/\s+/g, ' ').trim()
  const compact = (value) => norm(value).replace(/\s+/g, '')
  const vw = window.innerWidth || 1280
  const vh = window.innerHeight || 800

  const isVisible = (el) => {
    if (!el || !(el instanceof Element)) return false
    const style = window.getComputedStyle(el)
    if (!style || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) return false
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < vh
  }

  const uniqBy = (items, keyFn) => {
    const seen = new Set()
    const result = []
    for (const item of items) {
      const key = keyFn(item)
      if (seen.has(key)) continue
      seen.add(key)
      result.push(item)
    }
    return result
  }

  const extractByPatterns = (text, patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) return match[1]
    }
    return ''
  }

  const isNoiseText = (text) => {
    const normalized = compact(text)
    if (!normalized) return true
    if (normalized.length <= 6 && /^(发送|回顶部|搜索|筛选|聊天记录|消息|输入|展开|收起)$/.test(normalized)) return true
    if (/^(你撤回了一条信息|按Enter发送)$/.test(normalized)) return true
    if (/^(发送|回顶部|搜索|筛选|聊天记录|消息|输入)$/.test(normalized)) return true
    return false
  }

  const selectedTitleCandidates = []
  const selectedSelectors = [
    '[aria-selected="true"]',
    '[class*="active"]',
    '[class*="selected"]',
    '[class*="current"]',
  ]
  for (const selector of selectedSelectors) {
    for (const el of document.querySelectorAll(selector)) {
      if (!isVisible(el)) continue
      const text = norm(el.innerText || el.textContent || '')
      if (text && text.length <= 60 && !isNoiseText(text)) selectedTitleCandidates.push(text)
    }
  }

  const hrefs = Array.from(document.querySelectorAll('a[href]')).map((a) => a.href || '').filter(Boolean)
  const pageHints = [window.location.href, ...hrefs].join(' ')

  const itemTitleCandidates = []
  for (const el of document.querySelectorAll('a, h1, h2, h3, [title], [class*="title"], [class*="item"]')) {
    if (!isVisible(el)) continue
    const text = norm(el.innerText || el.textContent || el.getAttribute('title') || '')
    if (!text || text.length < 2 || text.length > 80 || isNoiseText(text)) continue
    const rect = el.getBoundingClientRect()
    if (rect.top > vh * 0.55) continue
    if (!/商品|租|日租|月租|型号|套餐|成色|押金|包邮|全新|出/.test(text) && !/itemId=|id=/.test((el.getAttribute('href') || '') + pageHints)) continue
    itemTitleCandidates.push(text)
  }

  const bubbleSelectors = [
    '[data-testid*="message"]',
    '[class*="message"]',
    '[class*="bubble"]',
    '[class*="msg"]',
    '[class*="content"]',
  ]

  let bubbleNodes = []
  for (const selector of bubbleSelectors) {
    bubbleNodes = bubbleNodes.concat(Array.from(document.querySelectorAll(selector)))
  }
  if (bubbleNodes.length === 0) {
    bubbleNodes = Array.from(document.querySelectorAll('div, span, p, li'))
  }

  let bubbles = []
  for (const el of bubbleNodes) {
    if (!isVisible(el)) continue
    if (el.closest('button, textarea, input, form, nav, header, footer, aside, [role="button"], [role="textbox"]')) continue
    const text = norm(el.innerText || el.textContent || '')
    if (!text || text.length > 200 || isNoiseText(text)) continue
    const rect = el.getBoundingClientRect()
    if (rect.width < 24 || rect.width > vw * 0.72) continue
    if (rect.height < 12 || rect.height > 220) continue
    if (rect.top < 72 || rect.bottom > vh - 36) continue
    if (rect.left < vw * 0.18) continue
    bubbles.push({
      text,
      normalizedText: compact(text),
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    })
  }

    bubbles = uniqBy(bubbles, (item) => `${item.normalizedText}|${Math.round(item.top)}|${Math.round(item.left)}`)
  bubbles.sort((a, b) => (a.bottom - b.bottom) || (a.left - b.left))
    bubbles = bubbles.map((item) => ({
        ...item,
        direction: item.left > vw * 0.52 ? 'outgoing' : 'incoming',
    }))

  const conversationTitle = selectedTitleCandidates.find(Boolean) || norm(document.title.replace(/[-|_].*$/, '')) || 'browser-session'
  const itemTitle = itemTitleCandidates.find(Boolean) || conversationTitle

  let latest = bubbles[bubbles.length - 1] || null
  if (latest && (latest.text === conversationTitle || latest.normalizedText === compact(conversationTitle)) && bubbles.length > 1) {
    latest = bubbles[bubbles.length - 2]
  }

  const itemId = extractByPatterns(pageHints, [
    /[?&#]itemId=([0-9]{5,})/i,
    /[?&#]id=([0-9]{5,})/i,
    /\/item\/?([0-9]{5,})/i,
  ]) || `browser-item:${itemTitle}`

  const stableParticipant = compact(conversationTitle.split(/\s+/)[0] || conversationTitle) || 'unknown'
  const rawSessionId = extractByPatterns(pageHints, [
    /[?&#]cid=([^&#]+)/i,
    /[?&#]chatId=([^&#]+)/i,
    /[?&#]conversationId=([^&#]+)/i,
    /[?&#]sessionId=([^&#]+)/i,
  ])
  const sessionId = rawSessionId && rawSessionId.length >= 6
    ? rawSessionId
    : `browser-session:${itemId}:${stableParticipant}`

  const composerReady = !!document.querySelector('textarea, [contenteditable="true"], div[role="textbox"]')

  // ── 增强：从 IM 页面右侧商品卡片/顶部商品栏抓取详细信息 ──
  const pageTitle = (document.title || '').replace(/[-|_–—].*$/, '').trim()
  const cleanItemTitle = (itemTitle && itemTitle !== pageTitle && !/闲鱼/.test(itemTitle)) ? itemTitle : conversationTitle
  const itemInfo = { title: cleanItemTitle, desc: '', quantity: 1, soldPrice: 0, skuList: [] }

  // 1) 尝试从商品卡片区域抓取价格（必须 ≥ 5 才认为是有效价格）
  const pricePatterns = /(?:¥|￥|价格|售价|租金|日租|月租)[：:\s]*(\d+(?:\.\d+)?)/
  const priceEls = document.querySelectorAll(
    '[class*="price"], [class*="amount"], [class*="cost"], [class*="money"], ' +
    '[class*="item"] span, [class*="goods"] span, [class*="product"] span'
  )
  for (const el of priceEls) {
    if (!isVisible(el)) continue
    const rect = el.getBoundingClientRect()
    // 价格通常在聊天区右上方，不在左侧会话列表中
    if (rect.left < vw * 0.35) continue
    const text = norm(el.innerText || el.textContent || '')
    // 直接是 ¥xxx 格式
    const directNum = text.match(/^[¥￥]\s*(\d+(?:\.\d+)?)$/)
    if (directNum && parseFloat(directNum[1]) >= 5) { itemInfo.soldPrice = parseFloat(directNum[1]); break }
    const priceMatch = text.match(pricePatterns)
    if (priceMatch && parseFloat(priceMatch[1]) >= 5) { itemInfo.soldPrice = parseFloat(priceMatch[1]); break }
  }

  // 2) 从聊天顶部的商品信息栏抓取（闲鱼 IM 通常在聊天区域顶部显示商品摘要）
  const topBarSelectors = [
    '[class*="goods-card"]', '[class*="item-card"]', '[class*="product-card"]',
    '[class*="trade-card"]', '[class*="order-card"]',
    '[class*="goodsInfo"]', '[class*="itemInfo"]', '[class*="productInfo"]',
  ]
  for (const selector of topBarSelectors) {
    for (const card of document.querySelectorAll(selector)) {
      if (!isVisible(card)) continue
      const cardText = norm(card.innerText || card.textContent || '')
      if (!cardText || cardText.length < 4) continue

      // 提取标题（通常是第一行有意义的文本）
      const cardLines = cardText.split(/\n+/).map(norm).filter(l => l && l.length > 1)
      if (cardLines.length > 0 && cardLines[0].length >= 4 && cardLines[0].length <= 60 && !/闲鱼/.test(cardLines[0])) {
        itemInfo.title = cardLines[0]
      }

      // 提取价格
      if (!itemInfo.soldPrice) {
        const pm = cardText.match(/[¥￥]\s*(\d+(?:\.\d+)?)/)
        if (pm && parseFloat(pm[1]) >= 5) itemInfo.soldPrice = parseFloat(pm[1])
      }

      // 提取描述（合并剩余行）
      if (cardLines.length > 1) {
        itemInfo.desc = cardLines.slice(1).join(' ').substring(0, 200)
      }
      break
    }
  }

  // 3) 遍历聊天区域右上方的所有可见文本，兜底抓价格
  if (!itemInfo.soldPrice) {
    for (const el of document.querySelectorAll('span, div, p')) {
      if (!isVisible(el)) continue
      const rect = el.getBoundingClientRect()
      // 只看右半部分、顶部区域（商品信息通常在聊天区右上）
      if (rect.left < vw * 0.4 || rect.top > vh * 0.25) continue
      const text = norm(el.innerText || el.textContent || '')
      const pm = text.match(/[¥￥]\s*(\d+(?:\.\d+)?)/)
      if (pm && parseFloat(pm[1]) >= 5) {
        itemInfo.soldPrice = parseFloat(pm[1])
        break
      }
    }
  }

  // 4) 尝试从商品卡片中抓取 SKU 信息
  const skuEls = document.querySelectorAll('[class*="sku"], [class*="spec"], [class*="attr"], [class*="tag"]')
  for (const el of skuEls) {
    if (!isVisible(el)) continue
    const text = norm(el.innerText || el.textContent || '')
    if (text && text.length >= 2 && text.length <= 40 && !/发送|搜索|筛选/.test(text)) {
      itemInfo.skuList.push({ text })
      if (itemInfo.skuList.length >= 10) break
    }
  }

  if (!latest) {
    return {
      ok: true,
      has_message: false,
      session_id: sessionId,
      item_id: itemId,
      conversation_title: conversationTitle,
      item_title: itemInfo.title,
      message_count: bubbles.length,
      composer_ready: composerReady,
      url: window.location.href,
      item_info: itemInfo,
            messages: bubbles.map((item) => ({ text: item.text, direction: item.direction })),
    }
  }

    const direction = latest.direction || (latest.left > vw * 0.52 ? 'outgoing' : 'incoming')
  return {
    ok: true,
    has_message: true,
    session_id: sessionId,
    item_id: itemId,
    sender_user_name: stableParticipant || conversationTitle,
    conversation_title: conversationTitle,
    item_title: itemTitle,
    message_text: latest.text,
    direction,
    message_count: bubbles.length,
    composer_ready: composerReady,
    url: window.location.href,
    signature: `${sessionId}|${direction}|${latest.normalizedText}`,
    item_info: itemInfo,
        messages: bubbles.map((item) => ({ text: item.text, direction: item.direction })),
  }
}
'''

SESSION_LIST_SCRIPT = r'''
() => {
  const norm = (value) => (value || '').replace(/\s+/g, ' ').trim()
  const compact = (value) => norm(value).replace(/\s+/g, '')
  const vw = window.innerWidth || 1280
  const vh = window.innerHeight || 800

  const isVisible = (el) => {
    if (!el || !(el instanceof Element)) return false
    const style = window.getComputedStyle(el)
    if (!style || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) return false
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < vh
  }

  const extractByPatterns = (text, patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) return match[1]
    }
    return ''
  }

  const normalizeTitle = (title) => {
    const base = norm(title)
      .replace(/\s+(刚刚|\d+分钟前|\d+小时前|昨天|前天).*$/i, '')
      .replace(/\s+你撤回了一条信息.*$/i, '')
      .replace(/\s+宝稍等.*$/i, '')
      .trim()
    return base || norm(title)
  }

    const extractSessionTimeText = (lines, text) => {
        const candidates = []
        for (const line of lines) candidates.push(line)
        candidates.push(text)
        const patterns = [
            /刚刚/,
            /\d+\s*分钟前/,
            /\d+\s*小时前/,
            /昨天\s*\d{1,2}:\d{2}/,
            /昨天/,
            /前天\s*\d{1,2}:\d{2}/,
            /前天/,
            /\d{1,2}:\d{2}/,
            /\d{1,2}月\d{1,2}日\s*\d{0,2}:?\d{0,2}/,
            /\d{4}[-/]\d{1,2}[-/]\d{1,2}\s*\d{0,2}:?\d{0,2}/,
        ]
        for (const value of candidates) {
            const current = norm(value)
            for (const pattern of patterns) {
                const match = current.match(pattern)
                if (match && match[0]) return norm(match[0])
            }
        }
        return ''
    }

  const rows = []
  let index = 0
  for (const el of document.querySelectorAll('a, div, li, section')) {
    if (!isVisible(el)) continue
    if (el.parentElement && el.parentElement.closest('[data-cc-session-index]')) continue

    const rect = el.getBoundingClientRect()
    if (rect.left > vw * 0.42) continue
    if (rect.width < 120 || rect.width > vw * 0.42) continue
    if (rect.height < 40 || rect.height > 160) continue
    if (rect.top < 56 || rect.bottom > vh - 20) continue

    const text = norm(el.innerText || el.textContent || '')
    if (!text || text.length < 2 || text.length > 180) continue
    if (/发送|输入|聊天记录|搜索|筛选/.test(text) && text.length <= 20) continue

    const lines = text.split(/\n+/).map(norm).filter(Boolean)
    const rawTitle = lines[0] || ''
    const title = normalizeTitle(rawTitle)
    if (!title || title.length > 60) continue

    const href = el.getAttribute('href') || ''
    const combinedHints = `${window.location.href} ${href} ${text}`
    const itemId = extractByPatterns(combinedHints, [
      /[?&#]itemId=([0-9]{5,})/i,
      /[?&#]id=([0-9]{5,})/i,
      /\/item\/?([0-9]{5,})/i,
    ]) || `browser-item:${title}`
    const participant = compact(title.split(/\s+/)[0] || title) || 'unknown'
    const sessionId = extractByPatterns(combinedHints, [
      /[?&#]cid=([^&#]+)/i,
      /[?&#]chatId=([^&#]+)/i,
      /[?&#]conversationId=([^&#]+)/i,
      /[?&#]sessionId=([^&#]+)/i,
    ]) || `browser-session:${itemId}:${participant}`

    const classText = (el.className || '').toString().toLowerCase()
    const selected = el.getAttribute('aria-selected') === 'true'
      || classText.includes('active')
      || classText.includes('selected')
      || classText.includes('current')

    el.setAttribute('data-cc-session-index', String(index))
    rows.push({
      index,
      session_id: sessionId,
      item_id: itemId,
      title,
      preview: lines[1] || '',
    time_text: extractSessionTimeText(lines, text),
      selected,
      top: rect.top,
    })
    index += 1
  }

  const deduped = []
  const seen = new Set()
  for (const row of rows) {
    const key = row.session_id
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(row)
  }
  deduped.sort((a, b) => a.top - b.top)
  return deduped
}
'''


class BrowserRunner:
    def __init__(self, config: dict, config_manager=None, context_manager=None, bot=None, knowledge_retriever=None):
        self.config = config
        self.config_manager = config_manager
        self.context_manager = context_manager
        self.bot = bot
        self.knowledge_retriever = knowledge_retriever
        self._running = False

        self.runtime_options = build_browser_runtime_options(config)
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None
        self._processor = None
        self._myid = ''
        self._seen_signatures = set()
        self._pending_auto_replies = {}
        self._item_cache = {}
        self._session_item_owner_cache = {}
        # 记录每个 session 启动后第一次看到的消息方向；outgoing 表示"我先发的问询"
        # → 我在这会话里是买家，后续 incoming 一律不自动回复。
        self._session_first_direction: Dict[str, str] = {}
        self._session_row_map = {}
        self._session_list_baseline = {}
        self._xianyu_api = None  # 浏览器模式不使用 API
        self._only_reply_my_listings = str(config.get('BROWSER_ONLY_REPLY_MY_LISTINGS', 'True')).strip().lower() == 'true'
        self._listing_owner_keywords = self._parse_listing_owner_keywords(config.get('LISTING_OWNER_KEYWORDS', ''))
        self._collect_only_mode = str(config.get('BROWSER_COLLECT_ONLY_MODE', 'False')).strip().lower() == 'true'
        try:
            self._history_sync_max_messages = int(config.get('BROWSER_HISTORY_SYNC_MAX_MESSAGES', '0'))
        except (TypeError, ValueError):
            self._history_sync_max_messages = 0
        self._history_sync_max_messages = max(0, min(self._history_sync_max_messages, 200))
        try:
            self._session_max_age_minutes = int(config.get('BROWSER_SESSION_MAX_AGE_MINUTES', '5'))
        except (TypeError, ValueError):
            self._session_max_age_minutes = 5
        self._session_max_age_minutes = max(0, min(self._session_max_age_minutes, 1440))
        self._last_session_debug_key = None
        self._last_snapshot_debug_key = None
        self._poll_round = 0
        self._startup_baseline_ready = False
        self._startup_quiet_until = 0
        self._auto_candidate_limit = 1
        self.manual_mode_conversations = set()
        self.manual_mode_timeout = int(config.get('MANUAL_MODE_TIMEOUT', '3600'))
        self.manual_mode_timestamps = {}
        self.toggle_keywords = config.get('TOGGLE_KEYWORDS', '。').strip()

        app_db_path = getattr(config_manager, 'db_path', None)
        chat_db_path = getattr(context_manager, 'db_path', None)
        self.rental_repository = RentalRepository(app_db_path, chat_db_path) if app_db_path else None
        if self.rental_repository:
            self.notification_service = NotificationService(self.rental_repository)
            self.schedule_service = ScheduleService(self.rental_repository)
            self.learning_service = LearningService(self.rental_repository, config=config)
            self.takeover_service = TakeoverService(self.rental_repository, self.notification_service)
            self.rental_agent_service = RentalAgentService(
                self.rental_repository,
                self.schedule_service,
                self.takeover_service,
                self.learning_service,
            )
            self.session_state_service = SessionStateService(self.rental_repository, config)
        else:
            self.notification_service = None
            self.schedule_service = None
            self.learning_service = None
            self.takeover_service = None
            self.rental_agent_service = None
            self.session_state_service = None

    async def main(self):
        self._running = True
        logger.info(f'Browser 模式启动: {browser_mode_summary(self.config)}')

        if not ensure_debug_browser(
            port=self.runtime_options['port'],
            reuse_existing=self.runtime_options['reuse_existing'],
            auto_launch=self.runtime_options['auto_launch'],
        ):
            raise RuntimeError('浏览器调试环境未就绪，无法启动 Browser 模式')

        try:
            from playwright.async_api import async_playwright

            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.connect_over_cdp(
                get_debug_http_base(self.runtime_options['port'])
            )
            self._context = await self._get_or_create_context()
            self._page = await self._get_or_create_page(self._context)
            await self._page.goto(get_xianyu_im_url(), wait_until='domcontentloaded')
            await self._sync_login_state()
            self._build_processor()

            logger.info('Browser 模式已接管闲鱼消息页，开始轮询会话')
            while self._running:
                try:
                    await self._poll_once()
                except Exception as e:
                    logger.warning(f'Browser 轮询异常，稍后重试: {e}')
                await asyncio.sleep(self.runtime_options['scan_interval_ms'] / 1000)
        finally:
            await self._cleanup()
            self._seen_signatures.clear()
            self._pending_auto_replies.clear()
            self._session_item_owner_cache.clear()
            self._session_row_map.clear()
            logger.info('Browser 模式已停止')

    def stop(self):
        self._running = False

    async def _poll_once(self):
        self._poll_round += 1
        sessions = await self._list_session_candidates()
        self._debug_log_sessions(sessions)
        if not self._startup_baseline_ready:
            self._capture_startup_baseline(sessions)
            await self._capture_current_page_message_baseline()
            self._startup_quiet_until = time.time() + 10
            self._startup_baseline_ready = True
            return

        if time.time() < self._startup_quiet_until:
            self._capture_startup_baseline(sessions)
            logger.debug('[browser] 启动静默期内仅刷新会话基线，不点击会话')
            return

        if not sessions:
            snapshot = await self._scan_page_snapshot()
            self._debug_log_snapshot(snapshot, stage='no-session-list')
            if snapshot:
                await self._handle_snapshot(snapshot)
            return

        await self._process_session_candidates(sessions)

    def _capture_startup_baseline(self, sessions: list):
        self._session_list_baseline = {
            item.get('session_id'): self._session_baseline_value(item)
            for item in sessions
            if item.get('session_id')
        }
        logger.info(f'[browser] 启动基线完成，已记录 {len(self._session_list_baseline)} 个历史会话，不再逐条打开历史会话')

    async def _capture_current_page_message_baseline(self):
        try:
            snapshot = await self._scan_page_snapshot()
        except Exception as exc:
            logger.debug(f'[browser] 启动当前页消息基线捕获失败: {exc}')
            return
        if self._remember_snapshot_signature(snapshot):
            logger.info('[browser] 启动当前页消息基线完成，当前打开会话的旧消息不会触发自动回复')

    def _pick_candidate_sessions(self, sessions: list) -> list:
        if not sessions:
            return []

        candidates = []
        _skip_title_kws = ('通知消息', '系统消息', '系统通知', '闲鱼小助手', '交易提醒')
        for item in self._limit_sessions_by_age_window(sessions, reason='自动监听'):
            session_id = item.get('session_id')
            if not session_id:
                continue
            title = item.get('title') or ''
            if any(kw in title for kw in _skip_title_kws):
                continue
            preview = self._session_baseline_value(item)
            baseline_preview = self._session_list_baseline.get(session_id)
            is_new_session = baseline_preview is None
            is_changed_session = baseline_preview is not None and preview != baseline_preview
            has_unread_signal = self._looks_like_unread_session(item)
            if is_new_session:
                self._session_list_baseline[session_id] = preview
                if has_unread_signal:
                    candidates.append(item)
                continue
            if is_changed_session:
                self._session_list_baseline[session_id] = preview
                if has_unread_signal:
                    candidates.append(item)
                else:
                    logger.debug(f'[browser] 会话预览变化但无未读特征，仅刷新基线不点击: session={session_id} title={title}')

        deduped = []
        seen = set()
        for item in candidates:
            session_id = item.get('session_id')
            if not session_id or session_id in seen:
                continue
            seen.add(session_id)
            deduped.append(item)
        return deduped

    def _session_baseline_value(self, item: dict) -> str:
        value = str(item.get('preview') or '').strip()
        time_text = str(item.get('time_text') or '').strip()
        if time_text and value == time_text:
            value = ''
        value = re.sub(r'\b(new|未读|红点)\b', '', value, flags=re.IGNORECASE)
        value = re.sub(r'\s+', ' ', value).strip()
        return value

    def _limit_sessions_by_age_window(self, sessions: list, reason: str = '') -> list:
        if not sessions or self._session_max_age_minutes <= 0:
            return sessions or []
        limited = []
        max_age_seconds = self._session_max_age_minutes * 60
        for item in sorted(sessions, key=lambda row: float(row.get('top') or 9999)):
            age_seconds = self._parse_session_age_seconds(item.get('time_text'))
            if age_seconds is not None and age_seconds > max_age_seconds:
                logger.info(
                    f'[browser] 会话时间超过窗口，停止向下读取: reason={reason} '
                    f'time={item.get("time_text") or ""} age={int(age_seconds)}s '
                    f'limit={self._session_max_age_minutes}min title={item.get("title") or ""}'
                )
                break
            limited.append(item)
        return limited

    def _parse_session_age_seconds(self, time_text: Optional[str]) -> Optional[float]:
        text = str(time_text or '').strip()
        if not text:
            return None
        now = time.localtime()
        if '刚刚' in text:
            return 0
        minute_match = re.search(r'(\d+)\s*分钟前', text)
        if minute_match:
            return int(minute_match.group(1)) * 60
        hour_match = re.search(r'(\d+)\s*小时前', text)
        if hour_match:
            return int(hour_match.group(1)) * 3600
        if text.startswith('昨天'):
            return 24 * 3600
        if text.startswith('前天'):
            return 48 * 3600

        clock_match = re.search(r'(\d{1,2}):(\d{2})', text)
        if clock_match and not re.search(r'\d{1,2}月\d{1,2}日|\d{4}[-/]\d{1,2}[-/]\d{1,2}', text):
            hour = int(clock_match.group(1))
            minute = int(clock_match.group(2))
            today_seconds = now.tm_hour * 3600 + now.tm_min * 60 + now.tm_sec
            message_seconds = hour * 3600 + minute * 60
            age = today_seconds - message_seconds
            return age if age >= 0 else age + 24 * 3600

        month_day_match = re.search(r'(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2}):(\d{2}))?', text)
        if month_day_match:
            month = int(month_day_match.group(1))
            day = int(month_day_match.group(2))
            hour = int(month_day_match.group(3) or 0)
            minute = int(month_day_match.group(4) or 0)
            try:
                message_ts = time.mktime((now.tm_year, month, day, hour, minute, 0, 0, 0, -1))
                age = time.time() - message_ts
                return age if age >= 0 else None
            except Exception:
                return None

        date_match = re.search(r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s*(\d{1,2}):(\d{2}))?', text)
        if date_match:
            year = int(date_match.group(1))
            month = int(date_match.group(2))
            day = int(date_match.group(3))
            hour = int(date_match.group(4) or 0)
            minute = int(date_match.group(5) or 0)
            try:
                message_ts = time.mktime((year, month, day, hour, minute, 0, 0, 0, -1))
                age = time.time() - message_ts
                return age if age >= 0 else None
            except Exception:
                return None
        return None

    def _update_session_baseline(self, sessions: list):
        for item in sessions:
            session_id = item.get('session_id')
            if not session_id:
                continue
            self._session_list_baseline[session_id] = self._session_baseline_value(item)

    def _looks_like_unread_session(self, session: dict) -> bool:
        text = ' '.join([
            str(session.get('title') or ''),
            str(session.get('preview') or ''),
        ])
        normalized = text.replace(' ', '')
        if not normalized:
            return False
        return bool(
            '未读' in normalized
            or 'new' in normalized.lower()
            or '红点' in normalized
            or any(flag in normalized for flag in ['[1]', '[2]', '[3]', '[4]', '[5]', '[6]', '[7]', '[8]', '[9]'])
        )

    def _sort_candidate_sessions(self, sessions: list) -> list:
        return sorted(
            sessions,
            key=lambda item: (
                0 if self._looks_like_unread_session(item) else 1,
                float(item.get('top') or 9999),
            ),
        )

    async def _process_session_candidates(self, sessions: list):
        candidates = self._sort_candidate_sessions(self._pick_candidate_sessions(sessions))
        if not candidates:
            return
        if len(candidates) > self._auto_candidate_limit:
            logger.info(f'[browser] 自动监听候选 {len(candidates)} 个，本轮仅打开前 {self._auto_candidate_limit} 个，避免启动扫历史')
            candidates = candidates[:self._auto_candidate_limit]
        for session in candidates:
            await self._open_session(session)
            snapshot = await self._scan_page_snapshot()
            self._debug_log_snapshot(snapshot, stage='candidate-session')
            if snapshot:
                await self._handle_snapshot(snapshot)
        self._update_session_baseline(sessions)

    def _remember_snapshot_signature(self, snapshot: Optional[dict]) -> bool:
        if not snapshot or not snapshot.get('has_message'):
            return False
        signature = self._message_signature(snapshot)
        if not signature or signature in self._seen_signatures:
            return False
        self._seen_signatures.add(signature)
        return True

    async def _get_or_create_context(self):
        if self._browser.contexts:
            return self._browser.contexts[0]
        return await self._browser.new_context()

    async def _get_or_create_page(self, context):
        for page in context.pages:
            url = (page.url or '').lower()
            if 'goofish.com/im' in url:
                return page
        return await context.new_page()

    async def _sync_login_state(self):
        cookies = await self._context.cookies()
        cookie_str = _extract_cookie_str(cookies)
        if self.config_manager and cookie_str:
            self.config_manager.update_cookies(cookie_str)
        if not has_login_cookie(cookie_str):
            raise RuntimeError('当前浏览器未检测到闲鱼登录态，请先登录闲鱼')

        latest_cookies = extract_cookies_from_cookie_header(cookie_str)

        self._myid = latest_cookies.get('unb', '')
        if not self._myid:
            raise RuntimeError('无法从浏览器 Cookie 中识别卖家身份')
        logger.info(f'Browser 模式登录态已确认，卖家 ID: {self._myid}')
        return latest_cookies

    def _build_processor(self):
        self._processor = ConversationProcessor(
            myid=self._myid,
            context_manager=self.context_manager,
            bot=self.bot,
            knowledge_retriever=self.knowledge_retriever,
            rental_repository=self.rental_repository,
            learning_service=self.learning_service,
            takeover_service=self.takeover_service,
            rental_agent_service=self.rental_agent_service,
            session_state_service=self.session_state_service,
            intent_router=IntentRouter(
                rental_agent_service=self.rental_agent_service,
                enabled=str(self.config.get('INTENT_ROUTER_ENABLED', 'false')).strip().lower() == 'true',
                log_only=str(self.config.get('INTENT_ROUTER_LOG_ONLY', 'true')).strip().lower() == 'true',
            ),
            quote_service=(
                QuoteService(
                    schedule_service=self.schedule_service,
                    pricing_repository=PricingRepository(self.rental_repository),
                    sf_delivery_service=SfDeliveryService(
                        ship_from_city=self.config.get('SF_SHIP_FROM_CITY', '上海') or '上海',
                    ),
                    enabled=str(self.config.get('QUOTE_SERVICE_ENABLED', 'false')).strip().lower() == 'true',
                )
                if self.rental_repository and self.schedule_service else None
            ),
            booking_service=(
                BookingService(
                    rental_repository=self.rental_repository,
                    config=self.config,
                    schedule_service=self.schedule_service,
                    notification_service=getattr(self, 'notification_service', None),
                )
                if self.rental_repository else None
            ),
            config=self.config,
            simulate_human_typing=str(self.config.get('SIMULATE_HUMAN_TYPING', 'False')).lower() == 'true',
            on_send_reply=self._send_reply_from_event,
            on_toggle_manual_mode=self._handle_seller_control_message,
            on_is_manual_mode=self.is_manual_mode,
            on_fetch_item_info=self._fetch_item_info,
            on_should_skip_bracket_message=self._should_skip_bracket_message,
            on_should_skip_system_message=self._should_skip_system_payload,
        )

    def _should_skip_bracket_message(self, message: str) -> bool:
        if not message or not isinstance(message, str):
            return False
        clean_message = message.strip()
        return clean_message.startswith('[') and clean_message.endswith(']')

    def _should_skip_system_payload(self, payload: object) -> bool:
        if not isinstance(payload, dict):
            return False
        message_text = str(payload.get('message_text') or '').strip()
        normalized = message_text.replace(' ', '')
        if not normalized:
            return True
        if normalized in {'发送', '回顶部', '搜索', '筛选', '聊天记录', '消息', '输入'}:
            return True
        if normalized == '你撤回了一条信息':
            return True
        conversation_title = str(payload.get('conversation_title') or '')
        if message_text == conversation_title:
            return True

        # 过滤通知消息会话（系统推送、交易状态等）
        title_lower = conversation_title.lower()
        if any(kw in title_lower for kw in ('通知消息', '系统消息', '系统通知', '闲鱼小助手', '交易提醒')):
            logger.info(f'[browser] 跳过系统通知会话: {conversation_title}')
            return True

        # 订单 / 物流 / 评价状态关键词——对话 title 或消息正文里命中任意一个都视为系统/订单流会话，跳过。
        # 这能覆盖"我作为买家"的会话里对方卖家或闲鱼系统推送过来的状态通知（如
        #   "MskzL 订单已签收 [送花][送花]"、"樱桃 等待买家收货 [订单派送中，请注意查收]"）。
        order_state_keywords = (
            '订单已签收', '订单派送中', '等待买家收货', '等待买家付款', '等待卖家发货',
            '等待买家发货', '卖家已发货', '买家已付款', '买家已确认收货', '买家已收货',
            '交易成功', '交易关闭', '交易已关闭', '超时未付款', '超时未发货',
            '已签收', '派送中', '运输中', '待发货', '待收货', '待付款',
            '请及时发货', '请尽快发货', '请确认收货', '确认收货奖励',
            '快给ta一个评价', '给ta一个评价', '已评价', '去评价',
            '退款成功', '退款申请', '退货申请', '拒绝退款', '同意退款',
            '订单派送中，请注意查收', '[订单派送中，请注意查收]', '[送花]',
        )
        haystack_title = conversation_title
        if any(kw in haystack_title for kw in order_state_keywords) or any(kw in message_text for kw in order_state_keywords):
            logger.info(f'[browser] 跳过订单状态会话/消息: title={conversation_title!r} msg={message_text[:40]!r}')
            return True

        # 过滤系统推送内容（奖励、红包、活动等）
        system_patterns = (
            '奖励待领取', '去领取', '闲鱼币', '能量', '兑好礼', '限时有效',
            '确认收货奖励', '下单成功奖励', '红包', '优惠券', '活动',
            '等待买家付款', '交易关闭', '等待卖家发货', '交易成功',
            '卖家已发货', '买家已确认收货', '超时未付款',
            '评价', '快给ta一个评价',
        )
        if any(kw in normalized for kw in system_patterns):
            logger.info(f'[browser] 跳过系统推送消息: {message_text[:40]}')
            return True

        return False

    def _extract_item_owner_id(self, item_info: Optional[dict]) -> Optional[str]:
        if not isinstance(item_info, dict):
            return None

        id_keys = {
            'userId', 'sellerId', 'ownerId', 'accountId', 'fishUserId', 'publisherId',
            'user_id', 'seller_id', 'owner_id', 'account_id', 'seller_id_str', 'user_id_str',
            'ownerUserId', 'sellerUserId', 'publisherUserId', 'itemUserId', 'userIdStr',
            'owner_user_id', 'seller_user_id', 'publisher_user_id', 'item_user_id'
        }
        object_keys = {
            'sellerDO', 'seller', 'userDO', 'user', 'owner', 'ownerDO', 'publisher', 'publisherDO',
            'itemUserDO', 'sellerInfo', 'userInfo', 'accountDO', 'shareData', 'trackParams', 'author',
            'publisherInfo', 'ownerInfo', 'loginUserInfo'
        }
        visited = set()

        def walk(node):
            if isinstance(node, dict):
                marker = id(node)
                if marker in visited:
                    return None
                visited.add(marker)
                for key in id_keys:
                    value = node.get(key)
                    if value not in (None, ''):
                        return str(value)
                for key, value in node.items():
                    if key in object_keys or key.endswith('DO') or key.endswith('Info'):
                        found = walk(value)
                        if found:
                            return found
                for value in node.values():
                    if isinstance(value, (dict, list, tuple)):
                        found = walk(value)
                        if found:
                            return found
            elif isinstance(node, (list, tuple)):
                for value in node:
                    found = walk(value)
                    if found:
                        return found
            return None

        return walk(item_info)

    @staticmethod
    def _parse_listing_owner_keywords(raw_value) -> list:
        import re
        return [part.strip() for part in re.split(r'[,，\n\r]+', str(raw_value or '')) if part.strip()]

    def _extract_item_text_fragments(self, value) -> list:
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        if isinstance(value, dict):
            fragments = []
            for nested_value in value.values():
                fragments.extend(self._extract_item_text_fragments(nested_value))
            return fragments
        if isinstance(value, (list, tuple)):
            fragments = []
            for item in value:
                fragments.extend(self._extract_item_text_fragments(item))
            return fragments
        return [str(value)]

    def _extract_item_business_markers(self, item_info: Optional[dict]) -> dict:
        import re
        if not isinstance(item_info, dict):
            return {'biz_item_code': '', 'model_code': '', 'matched_keyword': '', 'reason': ''}
        fragments = []
        for key in ('title', 'desc', 'description', 'richTextDesc', 'summary'):
            fragments.extend(self._extract_item_text_fragments(item_info.get(key)))
        text = '\n'.join(fragment for fragment in fragments if fragment)
        biz_patterns = (
            re.compile(r'商品编码\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})', re.IGNORECASE),
            re.compile(r'业务编码\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})', re.IGNORECASE),
            re.compile(r'biz[_\s-]*item[_\s-]*code\s*[:：=]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})', re.IGNORECASE),
        )
        model_patterns = (
            re.compile(r'型号编码\s*[:：]\s*([\u4e00-\u9fa5A-Za-z0-9][\u4e00-\u9fa5A-Za-z0-9._\-\s]{0,63})', re.IGNORECASE),
            re.compile(r'机型编码\s*[:：]\s*([\u4e00-\u9fa5A-Za-z0-9][\u4e00-\u9fa5A-Za-z0-9._\-\s]{0,63})', re.IGNORECASE),
            re.compile(r'机型\s*[:：]\s*([\u4e00-\u9fa5A-Za-z0-9][\u4e00-\u9fa5A-Za-z0-9._\-\s]{0,63})', re.IGNORECASE),
            re.compile(r'model[_\s-]*code\s*[:：=]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})', re.IGNORECASE),
        )
        biz_item_code = ''
        model_code = ''
        for fragment in fragments:
            if not biz_item_code:
                matched = next((pattern.search(fragment) for pattern in biz_patterns if pattern.search(fragment)), None)
                if matched:
                    biz_item_code = matched.group(1).strip()
            if not model_code:
                matched = next((pattern.search(fragment) for pattern in model_patterns if pattern.search(fragment)), None)
                if matched:
                    model_code = matched.group(1).strip()
            if biz_item_code and model_code:
                break
        matched_keyword = ''
        if text and self._listing_owner_keywords:
            normalized_text = text.lower()
            matched_keyword = next((kw for kw in self._listing_owner_keywords if kw.lower() in normalized_text), '')
        reason = ''
        if biz_item_code and model_code:
            reason = 'business_code_and_model'
        elif matched_keyword:
            reason = f'keyword:{matched_keyword}'
        return {
            'biz_item_code': biz_item_code,
            'model_code': model_code,
            'matched_keyword': matched_keyword,
            'reason': reason,
        }

    def _description_marks_my_listing(self, item_info: Optional[dict]) -> dict:
        markers = self._extract_item_business_markers(item_info)
        return markers if markers.get('reason') else {}

    def _is_my_listing(self, session_id: str, item_id: str, item_info: Optional[dict]) -> bool:
        if not self._only_reply_my_listings:
            return True

        cache_key = f'{session_id}|{item_id}'
        cached = self._session_item_owner_cache.get(cache_key)
        if cached is not None:
            return cached

        # 尝试从页面已有的 item_info 中提取 owner_id
        owner_id = self._extract_item_owner_id(item_info)
        if not owner_id and self.context_manager and item_id and not str(item_id).startswith('browser-item:'):
            try:
                item_record = self.context_manager.get_item_info_record(item_id) or {}
                owner_id = self._extract_item_owner_id(item_record.get('item_info') or {})
            except Exception as exc:
                logger.debug(f'[browser] 读取商品详情缓存做归属判定失败: item={item_id} error={exc}')
        if owner_id:
            allowed = str(owner_id) == str(self._myid)
            self._session_item_owner_cache[cache_key] = allowed
            logger.info(f'[browser] 商品归属判定(缓存/已有详情): session={session_id} item={item_id} owner={owner_id} myid={self._myid} allowed={allowed}')
            return allowed

        description_marker = self._description_marks_my_listing(item_info)
        if not description_marker and self.context_manager and item_id and not str(item_id).startswith('browser-item:'):
            try:
                item_record = self.context_manager.get_item_info_record(item_id) or {}
                description_marker = self._description_marks_my_listing(item_record.get('item_info') or {})
            except Exception as exc:
                logger.debug(f'[browser] 读取商品详情缓存做描述归属判定失败: item={item_id} error={exc}')
        if description_marker:
            self._session_item_owner_cache[cache_key] = True
            logger.info(
                f"[browser] 商品归属判定(描述标记): session={session_id} item={item_id} "
                f"reason={description_marker.get('reason')} biz={description_marker.get('biz_item_code')} "
                f"model={description_marker.get('model_code')} myid={self._myid} allowed=True"
            )
            return True

        logger.warning(f'[browser] 无法确认商品归属，安全起见跳过自动回复: session={session_id} item={item_id} myid={self._myid}')
        self._session_item_owner_cache[cache_key] = False
        return False

    def _message_signature(self, snapshot: dict) -> str:
        session_id = snapshot.get('session_id') or 'browser-session:unknown'
        direction = snapshot.get('direction') or 'unknown'
        message_text = str(snapshot.get('message_text') or '').strip().replace(' ', '')
        return f'{session_id}|{direction}|{message_text}'

    def _normalize_session_id(self, session_id: Optional[str], item_id: Optional[str], sender_name: Optional[str]) -> str:
        if session_id and not any(token in str(session_id) for token in ['刚刚', '分钟前', '小时前', '你撤回了一条信息', '宝稍等']):
            return str(session_id)
        stable_sender = ''.join(str(sender_name or '').split()) or 'unknown'
        stable_item = str(item_id or 'browser-item:unknown')
        return f'browser-session:{stable_item}:{stable_sender}'

    def _handle_seller_control_message(self, event: InboundChatEvent) -> bool:
        if event.sender_user_id != self._myid:
            return False
        if event.message_text.strip() != self.toggle_keywords:
            return False
        mode = self.toggle_manual_mode(event.session_id)
        if mode == 'manual':
            logger.info(f'[browser] 已接管会话 {event.session_id}')
        else:
            logger.info(f'[browser] 已恢复会话 {event.session_id} 的自动回复')
        return True

    def is_manual_mode(self, chat_id: str):
        if chat_id not in self.manual_mode_conversations:
            return False
        current_time = time.time()
        if chat_id in self.manual_mode_timestamps and current_time - self.manual_mode_timestamps[chat_id] > self.manual_mode_timeout:
            self.exit_manual_mode(chat_id)
            return False
        return True

    def enter_manual_mode(self, chat_id: str):
        self.manual_mode_conversations.add(chat_id)
        self.manual_mode_timestamps[chat_id] = time.time()
        if self.session_state_service:
            self.session_state_service.on_manual_toggle(chat_id, True)

    def exit_manual_mode(self, chat_id: str):
        self.manual_mode_conversations.discard(chat_id)
        if chat_id in self.manual_mode_timestamps:
            del self.manual_mode_timestamps[chat_id]
        if self.session_state_service:
            self.session_state_service.on_manual_toggle(chat_id, False)

    def toggle_manual_mode(self, chat_id: str):
        if self.is_manual_mode(chat_id):
            self.exit_manual_mode(chat_id)
            return 'auto'
        self.enter_manual_mode(chat_id)
        return 'manual'

    def _fetch_item_info(self, item_id: str):
        return self._item_cache.get(item_id) or {
            'title': item_id,
            'desc': '',
            'quantity': 1,
            'soldPrice': 0,
            'skuList': [],
        }

    async def _list_session_candidates(self):
        if self._page.is_closed():
            raise RuntimeError('闲鱼消息页已关闭')
        sessions = await self._page.evaluate(SESSION_LIST_SCRIPT)
        self._session_row_map = {item['session_id']: item for item in sessions if item.get('session_id')}
        return sessions

    async def _open_session(self, session: dict):
        selector = f"[data-cc-session-index=\"{session['index']}\"]"
        locator = self._page.locator(selector).first
        if await locator.count() == 0:
            return
        try:
            if await locator.is_visible():
                await locator.click()
                await asyncio.sleep(random.uniform(0.8, 1.6))
        except Exception as e:
            logger.debug(f"[browser] 切换会话失败: {session.get('title')} {e}")

    async def _open_session_by_id(self, session_id: str) -> bool:
        session = self._session_row_map.get(session_id)
        if not session:
            sessions = await self._list_session_candidates()
            session = next((item for item in sessions if item.get('session_id') == session_id), None)
        if not session:
            return False
        await self._open_session(session)
        return True

    async def _scan_page_snapshot(self):
        if self._page.is_closed():
            raise RuntimeError('闲鱼消息页已关闭')
        return await self._page.evaluate(SCAN_PAGE_SCRIPT)

    def _debug_log_sessions(self, sessions: list):
        summary = [
            {
                'title': item.get('title', ''),
                'session_id': item.get('session_id', ''),
                'item_id': item.get('item_id', ''),
                'selected': bool(item.get('selected')),
                'preview': item.get('preview', ''),
                'time': item.get('time_text', ''),
            }
            for item in sessions[:8]
        ]
        debug_key = str(summary)
        if self._last_session_debug_key == debug_key and (self._poll_round % 10) != 1:
            return
        self._last_session_debug_key = debug_key
        logger.info(f'[browser][debug] 会话列表({len(sessions)}): {summary}')

    def _debug_log_snapshot(self, snapshot: Optional[dict], stage: str):
        if not snapshot:
            debug_key = f'{stage}:none'
            if self._last_snapshot_debug_key == debug_key and (self._poll_round % 10) != 1:
                return
            self._last_snapshot_debug_key = debug_key
            logger.info(f'[browser][debug] 页面快照[{stage}]: <empty>')
            return

        summary = {
            'stage': stage,
            'session_id': snapshot.get('session_id'),
            'item_id': snapshot.get('item_id'),
            'conversation_title': snapshot.get('conversation_title'),
            'message_text': snapshot.get('message_text'),
            'direction': snapshot.get('direction'),
            'message_count': snapshot.get('message_count'),
            'composer_ready': snapshot.get('composer_ready'),
            'url': snapshot.get('url'),
            'signature': snapshot.get('signature'),
            'item_info': snapshot.get('item_info'),
        }
        debug_key = str(summary)
        if self._last_snapshot_debug_key == debug_key and (self._poll_round % 10) != 1:
            return
        self._last_snapshot_debug_key = debug_key
        logger.info(f'[browser][debug] 页面快照: {summary}')

    async def _handle_snapshot(self, snapshot: dict):
        if not snapshot.get('has_message'):
            return

        item_id = snapshot.get('item_id') or 'browser-item:unknown'
        sender_name = snapshot.get('sender_user_name') or snapshot.get('conversation_title') or '买家'
        # 注意：不改写 session_id，保持与页面 DOM 一致（未读角标会让 id 末尾出现 :<数字>，
        # 清空后变成 :<昵称>）。跨渲染形态的等价判定由 SessionStateService 内部 _state_key 负责。
        snapshot['session_id'] = self._normalize_session_id(snapshot.get('session_id'), item_id, sender_name)

        message_text = (snapshot.get('message_text') or '').strip()
        if not message_text or self._should_skip_system_payload(snapshot):
            return

        if not self._remember_snapshot_signature(snapshot):
            return

        item_info = snapshot.get('item_info') or {}
        self._item_cache[item_id] = {
            'title': item_info.get('title') or snapshot.get('item_title') or item_id,
            'desc': item_info.get('desc', ''),
            'quantity': item_info.get('quantity', 1),
            'soldPrice': item_info.get('soldPrice', 0),
            'skuList': item_info.get('skuList', []),
        }

        direction = snapshot.get('direction')
        # 记住该 session 首次观察到的方向：
        #   first = 'outgoing'  → 启动后 "我" 主动先说话 → 我是买家、对方是卖家，整条会话都不自动回复
        #   first = 'incoming'  → 对方先开口 → 我是卖家、对方是买家，正常流程
        sess_id_for_role = snapshot.get('session_id') or 'browser-session:unknown'
        first_dir = self._session_first_direction.get(sess_id_for_role)
        if first_dir is None and direction in ('outgoing', 'incoming'):
            self._session_first_direction[sess_id_for_role] = direction
            first_dir = direction
        if first_dir == 'outgoing' and direction == 'incoming':
            logger.info(
                f'[browser] 跳过买家身份会话（我先发起的问询）: session={sess_id_for_role} msg={message_text[:30]}'
            )
            return

        if direction == 'outgoing':
            if self._is_recent_auto_reply(snapshot.get('session_id'), message_text):
                return
            toggle_keywords = str(self.config.get('TOGGLE_KEYWORDS', '。') or '。')
            if message_text in toggle_keywords:
                event = InboundChatEvent(
                    session_id=snapshot.get('session_id') or 'browser-session:unknown',
                    item_id=item_id,
                    sender_user_id=self._myid,
                    sender_user_name='seller',
                    message_text=message_text,
                    created_at_ms=int(time.time() * 1000),
                    source_mode='browser',
                    raw_payload=snapshot,
                )
                await self._processor.process_event(event)
                return

            # 非 toggle、非 bot 刚发出的 outgoing → 视为人工回复
            sess_id = snapshot.get('session_id') or 'browser-session:unknown'
            if self.session_state_service and not self.session_state_service.is_bot_outgoing(sess_id, message_text):
                logger.info(f'[browser] 检测到人工回复 会话={sess_id} 内容={message_text[:30]}')
                self.session_state_service.on_human_outgoing(sess_id)
            return

        if not self._is_my_listing(snapshot.get('session_id') or 'browser-session:unknown', item_id, self._item_cache.get(item_id)):
            logger.info(f"[browser] 跳过非本人发布商品会话: {snapshot.get('session_id')} 商品={item_id}")
            return

        synced = self._sync_snapshot_history(snapshot)
        if self._collect_only_mode:
            if synced > 0:
                logger.info(f'[browser] 只读采集模式：已同步 {synced} 条消息，会话={snapshot.get("session_id")}')
            return

        event = InboundChatEvent(
            session_id=snapshot.get('session_id') or 'browser-session:unknown',
            item_id=item_id,
            sender_user_id=f"buyer:{snapshot.get('session_id') or 'unknown'}",
            sender_user_name=sender_name,
            message_text=message_text,
            created_at_ms=int(time.time() * 1000),
            source_mode='browser',
            raw_payload=snapshot,
        )
        logger.info(
            f"[browser] 新消息 会话={event.session_id} 商品={event.item_id} 用户={event.sender_user_name} 内容={event.message_text}"
        )
        await self._processor.process_event(event)

    def _normalize_history_message(self, role: str, content: str) -> str:
        return f'{role}:{" ".join((content or "").strip().split())}'

    def _sync_snapshot_history(self, snapshot: dict) -> int:
        if not self.context_manager or not snapshot:
            return 0
        session_id = snapshot.get('session_id') or 'browser-session:unknown'
        item_id = snapshot.get('item_id') or 'browser-item:unknown'
        messages = snapshot.get('messages') or []
        candidates: List[dict] = []
        for item in messages:
            text = str((item or {}).get('text') or '').strip()
            direction = str((item or {}).get('direction') or '').strip()
            if not text or direction not in {'incoming', 'outgoing'}:
                continue
            role = 'assistant' if direction == 'outgoing' else 'user'
            candidates.append({'role': role, 'content': text})
        if not candidates:
            return 0
        if self._history_sync_max_messages <= 0:
            return 0
        if len(candidates) > self._history_sync_max_messages:
            candidates = candidates[-self._history_sync_max_messages:]

        existing = [m for m in self.context_manager.get_context_by_chat(session_id) if m.get('role') in {'user', 'assistant'}]
        existing_norm = [self._normalize_history_message(m.get('role', ''), m.get('content', '')) for m in existing]
        candidate_norm = [self._normalize_history_message(m['role'], m['content']) for m in candidates]

        overlap = 0
        max_overlap = min(len(existing_norm), len(candidate_norm))
        for size in range(max_overlap, 0, -1):
            if existing_norm[-size:] == candidate_norm[:size]:
                overlap = size
                break

        added = 0
        buyer_id = f'buyer:{session_id}'
        seller_id = self._myid or 'seller'
        for item in candidates[overlap:]:
            self.context_manager.add_message_by_chat(
                session_id,
                seller_id if item['role'] == 'assistant' else buyer_id,
                item_id,
                item['role'],
                item['content'],
            )
            added += 1
        return added

    async def sync_visible_history(self, limit: Optional[int] = None, mode: str = 'current') -> dict:
        """
        安全的历史同步。
        mode='current'  : 只抓当前页面打开的那个会话（零点击，最安全，默认）。
        mode='sweep'    : 遍历左侧会话列表，但带人类化随机延迟 + 硬上限（最多 HARD_CAP 个）。
        limit           : sweep 模式下最大扫描会话数，会被 HARD_CAP 截断。
        """
        HARD_CAP = 15          # 单次最多扫 15 个会话，防止长时间刷列表
        DEFAULT_SWEEP = 8      # sweep 模式默认只扫 8 个
        if not self._page or self._page.is_closed():
            raise RuntimeError('浏览器消息页未就绪，请先启动浏览器模式机器人')

        scanned_sessions = 0
        added_messages = 0
        skipped_sessions = 0

        # 模式 1:只扫当前会话(零切换,风控最低)
        if mode != 'sweep':
            snapshot = await self._scan_page_snapshot()
            if snapshot:
                scanned_sessions = 1
                added_messages += self._sync_snapshot_history(snapshot)
            return {
                'mode': 'current',
                'scanned_sessions': scanned_sessions,
                'added_messages': added_messages,
                'skipped_sessions': skipped_sessions,
            }

        # 模式 2:sweep,人类化节奏扫一小批
        sessions = await self._list_session_candidates()
        sessions = self._limit_sessions_by_age_window(sessions, reason='历史同步')
        try:
            parsed = int(limit) if limit else DEFAULT_SWEEP
        except (TypeError, ValueError):
            parsed = DEFAULT_SWEEP
        parsed = max(1, min(parsed, HARD_CAP))
        sessions = sessions[:parsed]

        if not sessions:
            snapshot = await self._scan_page_snapshot()
            if snapshot:
                scanned_sessions = 1
                added_messages += self._sync_snapshot_history(snapshot)
            return {
                'mode': 'sweep',
                'scanned_sessions': scanned_sessions,
                'added_messages': added_messages,
                'skipped_sessions': skipped_sessions,
            }

        for idx, session in enumerate(sessions):
            try:
                await self._open_session(session)
                # 人类化随机停留:读一会再切下一个
                await asyncio.sleep(random.uniform(2.2, 4.8))
                snapshot = await self._scan_page_snapshot()
                self._debug_log_snapshot(snapshot, stage='history-sync')
                if not snapshot:
                    skipped_sessions += 1
                    continue
                scanned_sessions += 1
                added_messages += self._sync_snapshot_history(snapshot)
                # 每扫 4 个,额外长停一下,打散节奏
                if (idx + 1) % 4 == 0:
                    await asyncio.sleep(random.uniform(5.0, 9.0))
            except Exception as e:
                skipped_sessions += 1
                logger.warning(f'[browser] 历史同步跳过会话 {session.get("session_id")}: {e}')

        return {
            'mode': 'sweep',
            'scanned_sessions': scanned_sessions,
            'added_messages': added_messages,
            'skipped_sessions': skipped_sessions,
        }

    def _is_recent_auto_reply(self, session_id: Optional[str], text: str) -> bool:
        key = f'{session_id}|{text}'
        ts = self._pending_auto_replies.get(key)
        if not ts:
            return False
        if (time.time() - ts) <= 15:
            return True
        self._pending_auto_replies.pop(key, None)
        return False

    async def _send_reply_from_event(self, event: InboundChatEvent, reply_text: str):
        if self._collect_only_mode:
            logger.info(f'[browser] 只读采集模式已开启，跳过发送: {reply_text[:50]}')
            return
        await self._list_session_candidates()
        switched = await self._open_session_by_id(event.session_id)
        if not switched:
            logger.warning(f'[browser] 未在当前可见会话列表中定位到目标会话: {event.session_id}')

        snapshot = await self._scan_page_snapshot()
        self._debug_log_snapshot(snapshot, stage='before-send')
        current_session = snapshot.get('session_id')
        if current_session and event.session_id != current_session:
            logger.warning(f'[browser] 页面当前会话已切换，跳过发送。目标={event.session_id} 当前={current_session}')
            return

        await self._fill_reply(reply_text)
        await self._submit_reply()
        self._pending_auto_replies[f'{event.session_id}|{reply_text}'] = time.time()
        if self.session_state_service:
            self.session_state_service.mark_bot_sent(event.session_id, reply_text)
        await self._verify_reply_sent(event.session_id, reply_text)
        logger.info(f'[browser] 已发送回复: {reply_text}')

    async def _fill_reply(self, reply_text: str):
        input_target = await self._find_message_input()
        if input_target is None:
            raise RuntimeError('未找到消息输入框')

        tag_name = (await input_target.evaluate('(el) => el.tagName.toLowerCase()')).lower()
        contenteditable = await input_target.get_attribute('contenteditable')
        await input_target.click()

        if tag_name in {'textarea', 'input'}:
            await input_target.fill(reply_text)
            return

        if contenteditable == 'true':
            await self._page.keyboard.press('ControlOrMeta+A')
            await self._page.keyboard.press('Backspace')
            await self._page.keyboard.insert_text(reply_text)
            return

        await input_target.fill(reply_text)

    async def _submit_reply(self):
        button = await self._find_send_button()
        if button is not None:
            await button.click()
            return
        await self._page.keyboard.press('Enter')

    async def _verify_reply_sent(self, session_id: str, reply_text: str):
        timeout_ms = self.runtime_options['send_verify_timeout_ms']
        deadline = time.time() + timeout_ms / 1000
        while time.time() < deadline:
            snapshot = await self._scan_page_snapshot()
            if (
                snapshot.get('session_id') == session_id
                and snapshot.get('direction') == 'outgoing'
                and (snapshot.get('message_text') or '').strip() == reply_text.strip()
            ):
                return
            await asyncio.sleep(0.3)
        logger.warning('[browser] 发送校验超时，未在页面上确认到最新回复')

    async def _find_message_input(self):
        selectors = [
            'textarea',
            'div[role="textbox"]',
            '[contenteditable="true"]',
        ]
        for selector in selectors:
            locator = self._page.locator(selector)
            count = await locator.count()
            for index in range(count):
                current = locator.nth(index)
                try:
                    if await current.is_visible():
                        return current
                except Exception:
                    continue
        return None

    async def _find_send_button(self):
        selectors = [
            'button:has-text("发送")',
            '[role="button"]:has-text("发送")',
            'button:has-text("Send")',
            'span:has-text("发送")',
        ]
        for selector in selectors:
            locator = self._page.locator(selector)
            count = await locator.count()
            for index in range(count):
                current = locator.nth(index)
                try:
                    if await current.is_visible():
                        return current
                except Exception:
                    continue
        return None

    async def _cleanup(self):
        if self._browser is not None:
            try:
                await self._browser.close()
            except Exception:
                pass
            self._browser = None
        if self._playwright is not None:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None
