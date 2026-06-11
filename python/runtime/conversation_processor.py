import asyncio
import json
import random
import re
from datetime import datetime
from typing import Awaitable, Callable, Optional

from loguru import logger

from .models import InboundChatEvent


class ConversationProcessor:
    _BIZ_ITEM_CODE_PATTERNS = [
        re.compile(r"商品编码\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})", re.IGNORECASE),
        re.compile(r"业务编码\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})", re.IGNORECASE),
        re.compile(r"biz[_\s-]*item[_\s-]*code\s*[:：=]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})", re.IGNORECASE),
    ]
    _MODEL_CODE_PATTERNS = [
        re.compile(r"型号编码\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})", re.IGNORECASE),
        re.compile(r"机型编码\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})", re.IGNORECASE),
        re.compile(r"model[_\s-]*code\s*[:：=]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})", re.IGNORECASE),
    ]

    def __init__(
        self,
        *,
        myid: str,
        context_manager,
        bot,
        knowledge_retriever=None,
        xianyu_api=None,
        rental_repository=None,
        learning_service=None,
        takeover_service=None,
        rental_agent_service=None,
        feishu_pending_store=None,
        session_state_service=None,
        intent_router=None,
        quote_service=None,
        booking_service=None,
        config: Optional[dict] = None,
        simulate_human_typing: bool = False,
        on_send_reply: Callable[[InboundChatEvent, str], Awaitable[None]],
        on_toggle_manual_mode: Optional[Callable[[InboundChatEvent], bool]] = None,
        on_is_manual_mode: Optional[Callable[[str], bool]] = None,
        on_before_manual_message_saved: Optional[Callable[[InboundChatEvent], None]] = None,
        on_fetch_item_info: Optional[Callable[[str], Optional[dict]]] = None,
        on_should_skip_bracket_message: Optional[Callable[[str], bool]] = None,
        on_should_skip_system_message: Optional[Callable[[object], bool]] = None,
    ):
        self.myid = myid
        self.context_manager = context_manager
        self.bot = bot
        self.knowledge_retriever = knowledge_retriever
        self.xianyu_api = xianyu_api
        self.rental_repository = rental_repository
        self.learning_service = learning_service
        self.takeover_service = takeover_service
        self.rental_agent_service = rental_agent_service
        self.feishu_pending_store = feishu_pending_store
        self.session_state_service = session_state_service
        self.intent_router = intent_router
        self.quote_service = quote_service
        self.booking_service = booking_service
        self.config = config or {}
        self.simulate_human_typing = simulate_human_typing
        self.on_send_reply = on_send_reply
        self.on_toggle_manual_mode = on_toggle_manual_mode
        self.on_is_manual_mode = on_is_manual_mode
        self.on_before_manual_message_saved = on_before_manual_message_saved
        self.on_fetch_item_info = on_fetch_item_info
        self.on_should_skip_bracket_message = on_should_skip_bracket_message
        self.on_should_skip_system_message = on_should_skip_system_message
        self._item_refresh_tasks = {}

    @staticmethod
    def format_price(price):
        try:
            return round(float(price) / 100, 2)
        except (ValueError, TypeError):
            return 0.0

    def build_item_description(self, item_info):
        clean_skus = []
        raw_sku_list = item_info.get('skuList', [])

        for sku in raw_sku_list:
            specs = [p['valueText'] for p in sku.get('propertyList', []) if p.get('valueText')]
            spec_text = ' '.join(specs) if specs else '默认规格'
            clean_skus.append({
                'spec': spec_text,
                'price': self.format_price(sku.get('price', 0)),
                'stock': sku.get('quantity', 0)
            })

        valid_prices = [s['price'] for s in clean_skus if s['price'] > 0]

        if valid_prices:
            min_price = min(valid_prices)
            max_price = max(valid_prices)
            if min_price == max_price:
                price_display = f'¥{min_price}'
            else:
                price_display = f'¥{min_price} - ¥{max_price}'
        else:
            main_price = round(float(item_info.get('soldPrice', 0)), 2)
            price_display = f'¥{main_price}'

        summary = {
            'title': item_info.get('title', ''),
            'desc': item_info.get('desc', ''),
            'price_range': price_display,
            'total_stock': item_info.get('quantity', 0),
            'sku_details': clean_skus
        }
        return json.dumps(summary, ensure_ascii=False)

    def _get_item_detail_ttl_seconds(self) -> int:
        try:
            ttl = int(self.config.get('ITEM_DETAIL_TTL_SECONDS', 1800))
        except (TypeError, ValueError):
            ttl = 1800
        return max(ttl, 60)

    def _get_item_detail_failure_cooldown_seconds(self) -> int:
        try:
            cooldown = int(self.config.get('ITEM_DETAIL_REFRESH_FAIL_COOLDOWN_SECONDS', 300))
        except (TypeError, ValueError):
            cooldown = 300
        return max(cooldown, 30)

    def _extract_text_fragments(self, value):
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        if isinstance(value, dict):
            fragments = []
            for nested_value in value.values():
                fragments.extend(self._extract_text_fragments(nested_value))
            return fragments
        if isinstance(value, list):
            fragments = []
            for item in value:
                fragments.extend(self._extract_text_fragments(item))
            return fragments
        return [str(value)]

    def _extract_biz_item_code(self, item_info):
        candidate_sources = [
            ('title', item_info.get('title')),
            ('desc', item_info.get('desc')),
            ('richTextDesc', item_info.get('richTextDesc')),
            ('summary', item_info.get('summary')),
        ]
        for source_name, raw_value in candidate_sources:
            for fragment in self._extract_text_fragments(raw_value):
                for pattern in self._BIZ_ITEM_CODE_PATTERNS:
                    matched = pattern.search(fragment)
                    if matched:
                        return matched.group(1).strip(), source_name
        return None, None

    def _extract_model_code(self, item_info):
        candidate_sources = [
            ('title', item_info.get('title')),
            ('desc', item_info.get('desc')),
            ('richTextDesc', item_info.get('richTextDesc')),
            ('summary', item_info.get('summary')),
        ]
        for source_name, raw_value in candidate_sources:
            for fragment in self._extract_text_fragments(raw_value):
                for pattern in self._MODEL_CODE_PATTERNS:
                    matched = pattern.search(fragment)
                    if matched:
                        return matched.group(1).strip(), source_name
        return None, None

    def _save_item_info_with_metadata(self, item_id: str, item_info: dict, detail_source: str):
        biz_item_code, biz_item_code_source = self._extract_biz_item_code(item_info)
        model_code, model_code_source = self._extract_model_code(item_info)
        detail_updated_at = datetime.now().isoformat()
        self.context_manager.save_item_info(
            item_id,
            item_info,
            biz_item_code=biz_item_code,
            biz_item_code_source=biz_item_code_source,
            detail_source=detail_source,
            detail_updated_at=detail_updated_at,
        )
        if self.rental_repository and (biz_item_code or model_code):
            try:
                self.rental_repository.upsert_item_model_mapping(
                    item_id=item_id,
                    biz_item_code=biz_item_code,
                    model_code=model_code,
                    source='detail_sync',
                    note=f"详情自动解析: biz={biz_item_code_source or '-'}, model={model_code_source or '-'}",
                )
            except Exception as exc:
                logger.warning(f'同步商品编码/型号编码到映射表失败: item_id={item_id}, error={exc}')

    def _should_refresh_item_info(self, item_id: str, item_record: Optional[dict]) -> bool:
        if not item_record:
            return True
        return self.context_manager.is_item_info_stale(item_id, self._get_item_detail_ttl_seconds())

    async def _refresh_item_info(self, item_id: str, fallback_item_info: Optional[dict]) -> Optional[dict]:
        self.context_manager.mark_item_refresh_started(item_id)
        try:
            logger.info(f'刷新商品信息: {item_id}')
            if self.on_fetch_item_info:
                item_info = self.on_fetch_item_info(item_id)
                if item_info:
                    self._save_item_info_with_metadata(item_id, item_info, 'fetch_callback')
                    return item_info

            if self.xianyu_api:
                api_result = self.xianyu_api.get_item_info(item_id)
                if 'data' in api_result and 'itemDO' in api_result['data']:
                    item_info = api_result['data']['itemDO']
                    self._save_item_info_with_metadata(item_id, item_info, 'api_fallback')
                    return item_info
                logger.warning(f'获取商品信息失败: {api_result}')

            self.context_manager.mark_item_refresh_failed(
                item_id,
                reason='empty_result',
                cooldown_seconds=self._get_item_detail_failure_cooldown_seconds(),
            )
        except Exception as exc:
            logger.warning(f'刷新商品信息异常: item_id={item_id}, error={exc}')
            self.context_manager.mark_item_refresh_failed(
                item_id,
                reason='exception',
                cooldown_seconds=self._get_item_detail_failure_cooldown_seconds(),
            )
        return fallback_item_info

    async def _refresh_item_info_singleflight(self, item_id: str, fallback_item_info: Optional[dict]) -> Optional[dict]:
        existing_task = self._item_refresh_tasks.get(item_id)
        if existing_task and not existing_task.done():
            logger.debug(f'商品详情刷新复用进行中的任务: {item_id}')
            return await existing_task

        async def runner():
            try:
                return await self._refresh_item_info(item_id, fallback_item_info)
            finally:
                self._item_refresh_tasks.pop(item_id, None)

        task = asyncio.create_task(runner())
        self._item_refresh_tasks[item_id] = task
        return await task

    async def _load_item_info(self, item_id: str):
        item_record = self.context_manager.get_item_info_record(item_id)
        if item_record and item_record.get('item_info') and not self._should_refresh_item_info(item_id, item_record):
            logger.info(f'从数据库获取商品信息: {item_id}')
            return item_record['item_info']

        if item_record and item_record.get('item_info'):
            logger.info(f'商品详情缓存已过期，尝试刷新: {item_id}')
        fallback_item_info = item_record.get('item_info') if item_record else None
        if item_record and not self.context_manager.can_refresh_item_info(item_id):
            logger.info(f'商品详情处于刷新冷却期，继续使用缓存: {item_id}')
            return fallback_item_info

        return await self._refresh_item_info_singleflight(item_id, fallback_item_info)

    async def process_event(self, event: InboundChatEvent):
        item_id = event.item_id
        send_user_id = event.sender_user_id
        send_user_name = event.sender_user_name
        send_message = event.message_text
        chat_id = event.session_id

        if send_user_id == self.myid:
            logger.debug('检测到卖家消息，检查是否为控制命令')
            if self.on_toggle_manual_mode and self.on_toggle_manual_mode(event):
                return
            self.context_manager.add_message_by_chat(chat_id, self.myid, item_id, 'assistant', send_message)
            logger.info(f'卖家人工回复 (会话: {chat_id}, 商品: {item_id}): {send_message}')
            if self.learning_service and self.rental_repository:
                recent_messages = self.rental_repository.find_recent_session_messages(chat_id, limit=6)
                user_question = None
                for row in reversed(recent_messages):
                    if row.get('role') == 'user':
                        user_question = row.get('content')
                        break
                if user_question:
                    self.learning_service.capture_manual_takeover(chat_id, item_id, user_question, send_message)
            return

        logger.info(f'用户: {send_user_name} (ID: {send_user_id}), 商品: {item_id}, 会话: {chat_id}, 消息: {send_message}')

        if self.on_is_manual_mode and self.on_is_manual_mode(chat_id):
            logger.info(f'会话 {chat_id} 处于人工接管模式，跳过自动回复')
            if self.on_before_manual_message_saved:
                self.on_before_manual_message_saved(event)
            self.context_manager.add_message_by_chat(chat_id, send_user_id, item_id, 'user', send_message)
            return

        if self.on_should_skip_bracket_message and self.on_should_skip_bracket_message(send_message):
            logger.info(f"检测到系统消息：'{send_message}'，跳过自动回复")
            return

        if self.on_should_skip_system_message and self.on_should_skip_system_message(event.raw_payload):
            logger.debug('系统消息，跳过处理')
            return

        # ── 会话状态机（Phase 1）：先判定是否需要静默或发兜底 ──
        session_state_info = None
        if self.session_state_service and self.session_state_service.enabled:
            self.session_state_service.on_buyer_message(chat_id, item_id)
            session_state_info = self.session_state_service.read_state(chat_id)
            cur_state = session_state_info['state']
            if cur_state in {'human_active', 'manual'}:
                logger.info(f'[session-state] 会话 {chat_id} 当前状态={cur_state}，跳过自动回复（仅落库）')
                self.context_manager.add_message_by_chat(chat_id, send_user_id, item_id, 'user', send_message)
                return
            if cur_state == 'cooldown':
                row = session_state_info['row']
                now = session_state_info['now']
                # 冷却期内先落库用户消息
                self.context_manager.add_message_by_chat(chat_id, send_user_id, item_id, 'user', send_message)
                # 判定是否发兜底催促语
                if self.session_state_service.should_send_followup(row, now):
                    followup_text = self.session_state_service.config.followup_text
                    logger.info(f'[session-state] 会话 {chat_id} 冷却超过阈值，发送兜底消息')
                    self.context_manager.add_message_by_chat(chat_id, self.myid, item_id, 'assistant', followup_text)
                    await self.on_send_reply(event, followup_text)
                    self.session_state_service.mark_followup_sent(chat_id)
                # 节流再通知一次人工（避免买家连续催促只收到一次飞书）
                if not self.session_state_service.should_throttle_notify(row, now) and self.takeover_service:
                    model_code = (
                        self.rental_agent_service.detect_model_code(item_id)
                        if self.rental_agent_service else None
                    )
                    self.takeover_service.create_and_notify(
                        chat_id, item_id, model_code, send_message,
                        'faq_miss_repeat', 'normal',
                    )
                    self.session_state_service.mark_notify(chat_id)
                else:
                    logger.debug(f'[session-state] 会话 {chat_id} 通知已节流')
                return

        item_info = await self._load_item_info(item_id)
        if not item_info:
            return

        item_record = self.context_manager.get_item_info_record(item_id) or {}
        item_mapping = (
            self.rental_repository.get_item_mapping_by_item_id(item_id)
            if self.rental_repository else None
        ) or {}
        biz_item_code = item_record.get('biz_item_code') or item_mapping.get('biz_item_code')
        model_code = item_mapping.get('model_code')

        item_description = f'当前商品的信息如下：{self.build_item_description(item_info)}'
        context = self.context_manager.get_context_by_chat(chat_id)

        knowledge = None
        if self.knowledge_retriever:
            try:
                try:
                    top_k = int(self.config.get('KNOWLEDGE_TOP_K', '3'))
                except (ValueError, TypeError):
                    logger.warning('[RAG] KNOWLEDGE_TOP_K 配置无效，使用默认值 3')
                    top_k = 3
                # Sprint 2: 优先走策略版检索（阈值 + 类目黑名单）
                policy_fn = getattr(self.knowledge_retriever, 'search_with_policy', None)
                if callable(policy_fn):
                    knowledge, kb_debug = await policy_fn(
                        send_message,
                        item_id=item_id,
                        biz_item_code=biz_item_code,
                        model_code=model_code,
                        top_k=top_k,
                    )
                    logger.info(
                        f"[RAG] policy raw={kb_debug.get('raw_count')} "
                        f"accepted={len(knowledge)} reason={kb_debug.get('reason')} "
                        f"min_score={kb_debug.get('min_score')} rejected={kb_debug.get('rejected')}"
                    )
                    if not knowledge:
                        knowledge = None
                else:
                    knowledge = await self.knowledge_retriever.search(
                        send_message,
                        item_id=item_id,
                        biz_item_code=biz_item_code,
                        model_code=model_code,
                        top_k=top_k,
                    )
                    if knowledge:
                        logger.info(f'[RAG] 检索到 {len(knowledge)} 条相关知识')
            except Exception as e:
                logger.warning(f'[RAG] 知识库检索失败，降级继续: {e}')
                knowledge = None

        if self.takeover_service:
            self.takeover_service.check_timeouts()

        # ── Sprint 5: Booking FSM 优先检查当前会话是否处于 quote_ready ──
        # 若处于 quote_ready，且买家回复含确认/取消关键词，立即处理，不再走 IntentRouter。
        if self.booking_service is not None and getattr(self.booking_service, 'enabled', False):
            try:
                b_reply = self.booking_service.handle_user_reply(
                    session_id=chat_id, message=send_message,
                )
            except Exception as e:
                logger.warning(f"[booking] handle_user_reply 异常，降级继续: {e}")
                b_reply = {"action": "noop"}
            b_action = (b_reply or {}).get("action", "noop")
            if b_action in ("confirm_ok", "cancelled", "expired"):
                logger.info(
                    f"[booking] session={chat_id} action={b_action} "
                    f"state={(b_reply or {}).get('state')}"
                )
                self.context_manager.add_message_by_chat(chat_id, send_user_id, item_id, 'user', send_message)
                reply_text = (b_reply or {}).get("reply_text") or ''
                if b_action == "expired" and not reply_text:
                    # 过期场景不自动回复，交给后续链路
                    pass
                elif reply_text:
                    self.context_manager.add_message_by_chat(chat_id, self.myid, item_id, 'assistant', reply_text)
                    await self.on_send_reply(event, reply_text)
                    if b_action == "confirm_ok" and self.takeover_service:
                        # 草稿入库后，同时创建接管任务让人工 owner 进来
                        draft_model = None
                        draft = (b_reply or {}).get("draft") or {}
                        draft_slots = draft.get("slots") or {}
                        draft_model = draft.get("model_code") or draft_slots.get("model_code")
                        try:
                            self.takeover_service.create_and_notify(
                                chat_id, item_id, draft_model, send_message,
                                'booking_drafted', 'high',
                            )
                        except Exception as e:
                            logger.debug(f"[booking] 创建接管任务失败（忽略）: {e}")
                    return

        # ── Intent Router（Sprint 1，默认关闭 / 或 log_only 模式）──
        intent_result = None
        if self.intent_router is not None and getattr(self.intent_router, 'enabled', False):
            try:
                intent_result = self.intent_router.classify(
                    send_message,
                    item_description=item_description,
                    context=context,
                )
                logger.info(
                    f"[decision] category={intent_result.category.value} "
                    f"confidence={intent_result.confidence:.2f} reason={intent_result.reason} "
                    f"slots={intent_result.slots} matched={intent_result.matched_keywords} session={chat_id}"
                )
                # log_only 模式：不改行为
                if getattr(self.intent_router, 'log_only', True):
                    intent_result = None
            except Exception as e:
                logger.warning(f"[decision] IntentRouter 分类失败，降级继续: {e}")
                intent_result = None

        # Intent Router 生效分支（log_only=False 时）
        if intent_result is not None:
            from services.intent_router import IntentCategory  # 延迟导入，避免循环依赖
            if intent_result.category == IntentCategory.IGNORE:
                logger.info(f"[decision] IGNORE → 跳过自动回复 (session={chat_id})")
                return
            # 其他类别当前暂沿用旧链路（SCHEDULE_QUOTE/BOOKING_CONFIRM 将在 Sprint 3/5 接入）
            # 仅 RISK_TAKEOVER 提前进入接管（保持既有安抚语行为）
            if intent_result.category == IntentCategory.RISK_TAKEOVER and self.takeover_service:
                self.context_manager.add_message_by_chat(chat_id, send_user_id, item_id, 'user', send_message)
                model_code = intent_result.slots.get('model_code') if intent_result.slots else None
                reason = intent_result.reason or 'risk_takeover'
                # 复用 takeover 的 reason 枚举（兼容已有飞书模板）
                tk_reason = 'bargain_or_change_price' if reason.startswith('risk:bargain') \
                    else 'sensitive_after_sale' if reason.startswith('risk:sensitive') \
                    else 'risk_takeover'
                self.takeover_service.create_and_notify(
                    chat_id, item_id, model_code, send_message, tk_reason, 'high',
                )
                reply_text = '宝稍等 我马上就来'
                self.context_manager.add_message_by_chat(chat_id, self.myid, item_id, 'assistant', reply_text)
                await self.on_send_reply(event, reply_text)
                if self.session_state_service and self.session_state_service.enabled:
                    self.session_state_service.on_default_reply_sent(chat_id, item_id, model_code)
                logger.info(f"[decision] RISK_TAKEOVER 已执行 (reason={reason})")
                return

            # ── Sprint 5: BOOKING_CONFIRM → BookingService ──
            if (
                intent_result.category == IntentCategory.BOOKING_CONFIRM
                and self.booking_service is not None
                and getattr(self.booking_service, 'enabled', False)
            ):
                self.context_manager.add_message_by_chat(chat_id, send_user_id, item_id, 'user', send_message)
                try:
                    b_res = self.booking_service.on_booking_confirm_intent(
                        session_id=chat_id,
                        item_id=item_id,
                        buyer_id=send_user_id,
                        slots=intent_result.slots or {},
                        message=send_message,
                    )
                except Exception as e:
                    logger.warning(f"[booking] on_booking_confirm_intent 异常: {e}")
                    b_res = {"action": "noop"}
                b_action = (b_res or {}).get("action", "noop")
                logger.info(f"[booking] BOOKING_CONFIRM session={chat_id} action={b_action}")
                if b_action == "followup":
                    reply_text = b_res.get("reply_text") or '稍等 我这边核对下~'
                    self.context_manager.add_message_by_chat(chat_id, self.myid, item_id, 'assistant', reply_text)
                    await self.on_send_reply(event, reply_text)
                    return
                # noop → 继续向下（SCHEDULE_QUOTE / fallback）完成流程

            # ── Sprint 3: SCHEDULE_QUOTE → QuoteService ──
            if (
                intent_result.category == IntentCategory.SCHEDULE_QUOTE
                and self.quote_service is not None
                and getattr(self.quote_service, 'enabled', False)
            ):
                self.context_manager.add_message_by_chat(chat_id, send_user_id, item_id, 'user', send_message)
                try:
                    req = self.quote_service.build_request(intent_result.slots or {})
                    result = self.quote_service.resolve(req)
                    logger.info(f"[decision] QUOTE {result.to_log_dict()}")
                except Exception as e:
                    logger.warning(f"[decision] QuoteService 异常，降级人工: {e}")
                    result = None

                if result is not None:
                    model_code = (intent_result.slots or {}).get('model_code')
                    if result.status in ('available', 'unavailable', 'need_more_info'):
                        reply_text = result.reply_text or result.followup_question or ''
                        if reply_text:
                            self.context_manager.add_message_by_chat(
                                chat_id, self.myid, item_id, 'assistant', reply_text,
                            )
                            await self.on_send_reply(event, reply_text)
                        # Sprint 5: 报价可租时，登记草稿进入 quote_ready，等待买家确认
                        if (
                            result.status == 'available'
                            and self.booking_service is not None
                            and getattr(self.booking_service, 'enabled', False)
                        ):
                            try:
                                self.booking_service.on_quote_available(
                                    session_id=chat_id,
                                    item_id=item_id,
                                    buyer_id=send_user_id,
                                    slots=intent_result.slots or {},
                                    quote=result.quote or {},
                                    reply_text=reply_text,
                                )
                            except Exception as e:
                                logger.debug(f"[booking] on_quote_available 失败（忽略）: {e}")
                        return
                    # needs_human
                    if self.takeover_service:
                        self.takeover_service.create_and_notify(
                            chat_id, item_id, model_code, send_message,
                            f"quote_{result.reason}"[:64], 'high',
                        )
                    fallback = result.reply_text or '宝稍等 我马上就来'
                    self.context_manager.add_message_by_chat(
                        chat_id, self.myid, item_id, 'assistant', fallback,
                    )
                    await self.on_send_reply(event, fallback)
                    if self.session_state_service and self.session_state_service.enabled:
                        self.session_state_service.on_default_reply_sent(chat_id, item_id, model_code)
                    return

        if self.rental_agent_service:
            intercept = self.rental_agent_service.handle_pre_reply(
                session_id=chat_id,
                item_id=item_id,
                item_description=item_description,
                user_message=send_message,
                context=context,
                has_knowledge=bool(knowledge),
            )
            if intercept['action'] in {'takeover', 'ask_followup', 'reply'}:
                self.context_manager.add_message_by_chat(chat_id, send_user_id, item_id, 'user', send_message)
                reply_text = intercept.get('reply_text')
                if reply_text:
                    self.context_manager.add_message_by_chat(chat_id, self.myid, item_id, 'assistant', reply_text)
                    logger.info(f'租赁流程回复: {reply_text}')
                    await self.on_send_reply(event, reply_text)
                # takeover 类默认回复后进入 cooldown，阻止后续重复默认回复
                if intercept['action'] == 'takeover' and self.session_state_service and self.session_state_service.enabled:
                    self.session_state_service.on_default_reply_sent(
                        chat_id, item_id, intercept.get('model_code'),
                    )
                if intercept['action'] == 'takeover' and self.on_toggle_manual_mode:
                    # 开启 session state 后，cooldown 即可阻止重复默认回复；
                    # 仅对高优先级原因（bargain/sensitive/schedule_unavailable）保留自动进入 manual。
                    state_enabled = bool(self.session_state_service and self.session_state_service.enabled)
                    reason = (intercept.get('task') or {}).get('reason') if isinstance(intercept.get('task'), dict) else None
                    should_manual = (not state_enabled) or (reason in {'bargain_or_change_price', 'sensitive_after_sale', 'schedule_unavailable'})
                    if should_manual:
                        self.on_toggle_manual_mode(InboundChatEvent(
                            session_id=chat_id,
                            item_id=item_id,
                            sender_user_id=self.myid,
                            sender_user_name='assistant',
                            message_text='。',
                            source_mode=event.source_mode,
                        ))
                        logger.info(f'会话 {chat_id} 已自动切换为人工接管模式')
                return

            # 功能性问题 → web search + 飞书确认后再回复
            if intercept['action'] == 'feishu_confirm' and self.feishu_pending_store:
                self.context_manager.add_message_by_chat(chat_id, send_user_id, item_id, 'user', send_message)
                # 先发默认回复
                default_reply = intercept.get('reply_text', '宝稍等 我马上赶来')
                self.context_manager.add_message_by_chat(chat_id, self.myid, item_id, 'assistant', default_reply)
                await self.on_send_reply(event, default_reply)

                # LLM web search 生成草稿
                ai_draft = None
                search_result = None
                try:
                    search_response = await asyncio.to_thread(
                        self.bot.generate_reply,
                        send_message,
                        item_description,
                        context,
                        knowledge,
                    )
                    if search_response and search_response != '-':
                        ai_draft = search_response
                except Exception as e:
                    logger.warning(f'[feishu-confirm] AI 草稿生成失败: {e}')

                # 入队等待飞书确认
                pending_id = self.feishu_pending_store.create({
                    'session_id': chat_id,
                    'item_id': item_id,
                    'model_code': intercept.get('model_code'),
                    'user_question': send_message,
                    'ai_draft': ai_draft,
                    'search_result': search_result,
                    'reply_type': intercept.get('reply_type', 'functional_search'),
                })
                logger.info(f'[feishu-confirm] 已创建待确认回复 #{pending_id}，等待人工审批')

                # 统一飞书卡片（Sprint 7）：把待确认回复推到销售群
                try:
                    notifier = getattr(self.takeover_service, 'notifier', None) if self.takeover_service else None
                    if notifier and hasattr(notifier, 'notify_pending_reply'):
                        notifier.notify_pending_reply(
                            pending_id=pending_id,
                            user_question=send_message,
                            ai_draft=ai_draft,
                            reason='kb_miss',
                            model_code=intercept.get('model_code'),
                            item_id=item_id,
                            session_id=chat_id,
                        )
                except Exception as e:
                    logger.warning(f'[feishu-confirm] 统一卡片推送失败: {e}')

                # 发飞书通知
                if self.takeover_service:
                    self.takeover_service.create_and_notify(
                        chat_id, item_id, intercept.get('model_code'),
                        f"[待确认] {send_message}\n\nAI草稿: {ai_draft or '生成失败'}",
                        'faq_miss', 'normal',
                    )
                return

        bot_reply = await asyncio.to_thread(
            self.bot.generate_reply,
            send_message,
            item_description,
            context,
            knowledge,
        )

        if bot_reply == '-':
            logger.info(f'[无需回复] 用户 {send_user_name} 的消息被识别为无需回复类型')
            return

        if (
            not knowledge
            and self.rental_agent_service
            and self.rental_agent_service.get_reply_mode() == 'boundary_augmented'
            and self.bot.last_intent in {'tech', 'default'}
            and self.rental_agent_service.xiaohongshu_enabled()
            and self.rental_agent_service.should_offer_xiaohongshu(send_message, bool(knowledge))
        ):
            model_code = self.rental_agent_service.detect_model_code(item_description) if self.rental_agent_service else None
            bot_reply = f'{bot_reply} {self.rental_agent_service.build_xiaohongshu_hint(model_code, send_message)}'

        self.context_manager.add_message_by_chat(chat_id, send_user_id, item_id, 'user', send_message)

        if self.bot.last_intent == 'price' and self.takeover_service:
            model_code = self.rental_agent_service.detect_model_code(item_description) if self.rental_agent_service else None
            self.takeover_service.create_and_notify(
                chat_id,
                item_id,
                model_code,
                send_message,
                'price_followup',
                'high',
            )
            return


        if self.bot.last_intent == 'price':
            self.context_manager.increment_bargain_count_by_chat(chat_id)
            bargain_count = self.context_manager.get_bargain_count_by_chat(chat_id)
            logger.info(f'用户 {send_user_name} 对商品 {item_id} 的议价次数: {bargain_count}')

        self.context_manager.add_message_by_chat(chat_id, self.myid, item_id, 'assistant', bot_reply)

        if knowledge and self.learning_service and self.bot.last_intent in {'default', 'tech'} and len(send_message) <= 30 and len(bot_reply) <= 80:
            self.learning_service.capture_manual_takeover(chat_id, item_id, send_message, bot_reply)

        if knowledge:
            logger.info('[rental] 已使用知识库增强回复')
        if self.bot.last_intent == 'price':
            logger.info('[rental] 价格场景已转人工处理')

        logger.info(f'机器人回复: {bot_reply}')

        if self.simulate_human_typing:
            base_delay = random.uniform(0, 1)
            typing_delay = len(bot_reply) * random.uniform(0.1, 0.3)
            total_delay = min(base_delay + typing_delay, 10.0)
            logger.info(f'模拟人工输入，延迟发送 {total_delay:.2f} 秒...')
            await asyncio.sleep(total_delay)

        await self.on_send_reply(event, bot_reply)
