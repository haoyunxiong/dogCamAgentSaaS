import base64
import json
import asyncio
import time
import os
import websockets
from loguru import logger

from XianyuApis import XianyuApis
import random


from utils.xianyu_utils import generate_mid, generate_uuid, trans_cookies, generate_device_id, decrypt
from XianyuAgent import XianyuReplyBot
from context_manager import ChatContextManager
from runtime import ConversationProcessor, InboundChatEvent
from services import LearningService, NotificationService, RentalAgentService, RentalRepository, ScheduleService, SessionStateService, TakeoverService
from services.intent_router import IntentRouter
from services.pricing_repository import PricingRepository
from services.sf_delivery_service import SfDeliveryService
from services.quote_service import QuoteService
from services.booking_service import BookingService


def _build_intent_router(config: dict, rental_agent_service):
    """根据 config 表开关构造 IntentRouter（默认关闭 + log_only）。"""
    enabled = str(config.get('INTENT_ROUTER_ENABLED', 'false')).strip().lower() == 'true'
    log_only = str(config.get('INTENT_ROUTER_LOG_ONLY', 'true')).strip().lower() == 'true'
    return IntentRouter(
        rental_agent_service=rental_agent_service,
        enabled=enabled,
        log_only=log_only,
    )


def _build_quote_service(config: dict, rental_repository, schedule_service):
    """Sprint 3 · 结构化报价服务（默认关闭）。"""
    if rental_repository is None or schedule_service is None:
        return None
    enabled = str(config.get('QUOTE_SERVICE_ENABLED', 'false')).strip().lower() == 'true'
    ship_from = config.get('SF_SHIP_FROM_CITY', '上海') or '上海'
    return QuoteService(
        schedule_service=schedule_service,
        pricing_repository=PricingRepository(rental_repository),
        sf_delivery_service=SfDeliveryService(ship_from_city=ship_from),
        enabled=enabled,
    )


def _build_booking_service(config: dict, rental_repository, schedule_service, notification_service):
    """Sprint 5 · 建单草稿状态机（默认关闭）。"""
    if rental_repository is None:
        return None
    return BookingService(
        rental_repository=rental_repository,
        config=config,
        schedule_service=schedule_service,
        notification_service=notification_service,
    )


class XianyuLive:
    def __init__(self, cookies_str: str, config: dict, config_manager=None, knowledge_retriever=None):
        self.xianyu = XianyuApis(config_manager=config_manager)
        self.config_manager = config_manager
        self.base_url = 'wss://wss-goofish.dingtalk.com/'
        self.cookies_str = cookies_str
        self.cookies = trans_cookies(cookies_str)
        self.xianyu.session.cookies.update(self.cookies)
        self.myid = self.cookies['unb']
        self.device_id = generate_device_id(self.myid)
        self.config = config

        # 心跳相关配置
        self.heartbeat_interval = int(config.get("HEARTBEAT_INTERVAL", "15"))
        self.heartbeat_timeout = int(config.get("HEARTBEAT_TIMEOUT", "5"))
        self.last_heartbeat_time = 0
        self.last_heartbeat_response = 0
        self.heartbeat_task = None
        self.ws = None

        # Token刷新相关配置
        self.token_refresh_interval = int(config.get("TOKEN_REFRESH_INTERVAL", "3600"))
        self.token_retry_interval = int(config.get("TOKEN_RETRY_INTERVAL", "300"))
        self.last_token_refresh_time = 0
        self.current_token = None
        self.token_refresh_task = None
        self.connection_restart_flag = False

        # 人工接管相关配置
        self.manual_mode_conversations = set()
        self.manual_mode_timeout = int(config.get("MANUAL_MODE_TIMEOUT", "3600"))
        self.manual_mode_timestamps = {}

        # 消息过期时间配置
        self.message_expire_time = int(config.get("MESSAGE_EXPIRE_TIME", "300000"))

        # 人工接管关键词
        self.toggle_keywords = config.get("TOGGLE_KEYWORDS", "。")

        # 模拟人工输入配置
        simulate_str = config.get("SIMULATE_HUMAN_TYPING", "False")
        self.simulate_human_typing = simulate_str.lower() == "true"

        # 知识库检索器
        self.knowledge_retriever = knowledge_retriever

        app_db_path = getattr(config_manager, 'db_path', None)
        chat_db_path = getattr(getattr(self, 'context_manager', None), 'db_path', None)
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

    def set_context_manager(self, context_manager: ChatContextManager):
        self.context_manager = context_manager
        if self.rental_repository:
            self.rental_repository.chat_db_path = context_manager.db_path
            self.learning_service = LearningService(self.rental_repository, config=getattr(self, 'config', None))
            self.takeover_service = TakeoverService(self.rental_repository, self.notification_service)
            self.rental_agent_service = RentalAgentService(
                self.rental_repository,
                self.schedule_service,
                self.takeover_service,
                self.learning_service,
            )
        elif getattr(self, 'config_manager', None) and getattr(self.config_manager, 'db_path', None):
            self.rental_repository = RentalRepository(self.config_manager.db_path, context_manager.db_path)
            self.notification_service = NotificationService(self.rental_repository)
            self.schedule_service = ScheduleService(self.rental_repository)
            self.learning_service = LearningService(self.rental_repository, config=getattr(self, 'config', None))
            self.takeover_service = TakeoverService(self.rental_repository, self.notification_service)
            self.rental_agent_service = RentalAgentService(
                self.rental_repository,
                self.schedule_service,
                self.takeover_service,
                self.learning_service,
            )
            self.session_state_service = SessionStateService(self.rental_repository, self.config)

    def set_bot(self, bot: XianyuReplyBot):
        self.bot = bot
        self.processor = ConversationProcessor(
            myid=self.myid,
            context_manager=self.context_manager,
            bot=self.bot,
            knowledge_retriever=self.knowledge_retriever,
            xianyu_api=self.xianyu,
            rental_repository=self.rental_repository,
            learning_service=self.learning_service,
            takeover_service=self.takeover_service,
            rental_agent_service=self.rental_agent_service,
            session_state_service=getattr(self, 'session_state_service', None),
            intent_router=_build_intent_router(self.config, self.rental_agent_service),
            quote_service=_build_quote_service(self.config, self.rental_repository, self.schedule_service),
            booking_service=_build_booking_service(
                self.config, self.rental_repository, self.schedule_service, self.notification_service,
            ),
            config=self.config,
            simulate_human_typing=self.simulate_human_typing,
            on_send_reply=self._send_reply_from_event,
            on_toggle_manual_mode=self._handle_seller_control_message,
            on_is_manual_mode=self.is_manual_mode,
            on_fetch_item_info=self._fetch_item_info,
            on_should_skip_bracket_message=self.is_bracket_system_message,
            on_should_skip_system_message=self.is_system_message,
        )

    def _fetch_item_info(self, item_id: str):
        api_result = self.xianyu.get_item_info(item_id)
        if 'data' in api_result and 'itemDO' in api_result['data']:
            return api_result['data']['itemDO']
        logger.warning(f"获取商品信息失败: {api_result}")
        return None

    def _handle_seller_control_message(self, event: InboundChatEvent) -> bool:
        if not self.check_toggle_keywords(event.message_text):
            return False
        mode = self.toggle_manual_mode(event.session_id)
        if mode == 'manual':
            logger.info(f"已接管会话 {event.session_id} (商品: {event.item_id})")
        else:
            logger.info(f"已恢复会话 {event.session_id} 的自动回复 (商品: {event.item_id})")
        return True

    async def _send_reply_from_event(self, event: InboundChatEvent, reply_text: str):
        await self.send_msg(self.ws, event.session_id, event.sender_user_id, reply_text)
        svc = getattr(self, 'session_state_service', None)
        if svc:
            svc.mark_bot_sent(event.session_id, reply_text)

    async def refresh_token(self):
        """刷新token"""
        try:
            logger.info("开始刷新token...")
            token_result = self.xianyu.get_token(self.device_id)
            if 'data' in token_result and 'accessToken' in token_result['data']:
                new_token = token_result['data']['accessToken']
                self.current_token = new_token
                self.last_token_refresh_time = time.time()
                logger.info("Token刷新成功")
                return new_token
            else:
                logger.error(f"Token刷新失败: {token_result}")
                return None
        except Exception as e:
            logger.error(f"Token刷新异常: {str(e)}")
            return None

    async def token_refresh_loop(self):
        """Token刷新循环"""
        while True:
            try:
                current_time = time.time()
                if current_time - self.last_token_refresh_time >= self.token_refresh_interval:
                    logger.info("Token即将过期，准备刷新...")
                    new_token = await self.refresh_token()
                    if new_token:
                        logger.info("Token刷新成功，准备重新建立连接...")
                        self.connection_restart_flag = True
                        if self.ws:
                            await self.ws.close()
                        break
                    else:
                        logger.error("Token刷新失败，将在{}分钟后重试".format(self.token_retry_interval // 60))
                        await asyncio.sleep(self.token_retry_interval)
                        continue
                await asyncio.sleep(60)
            except Exception as e:
                logger.error(f"Token刷新循环出错: {e}")
                await asyncio.sleep(60)

    async def send_msg(self, ws, cid, toid, text):
        text = {
            "contentType": 1,
            "text": {
                "text": text
            }
        }
        text_base64 = str(base64.b64encode(json.dumps(text).encode('utf-8')), 'utf-8')
        msg = {
            "lwp": "/r/MessageSend/sendByReceiverScope",
            "headers": {
                "mid": generate_mid()
            },
            "body": [
                {
                    "uuid": generate_uuid(),
                    "cid": f"{cid}@goofish",
                    "conversationType": 1,
                    "content": {
                        "contentType": 101,
                        "custom": {
                            "type": 1,
                            "data": text_base64
                        }
                    },
                    "redPointPolicy": 0,
                    "extension": {
                        "extJson": "{}"
                    },
                    "ctx": {
                        "appVersion": "1.0",
                        "platform": "web"
                    },
                    "mtags": {},
                    "msgReadStatusSetting": 1
                },
                {
                    "actualReceivers": [
                        f"{toid}@goofish",
                        f"{self.myid}@goofish"
                    ]
                }
            ]
        }
        await ws.send(json.dumps(msg))

    async def init(self, ws):
        if not self.current_token or (time.time() - self.last_token_refresh_time) >= self.token_refresh_interval:
            logger.info("获取初始token...")
            await self.refresh_token()

        if not self.current_token:
            logger.error("无法获取有效token，初始化失败")
            raise Exception("Token获取失败")

        msg = {
            "lwp": "/reg",
            "headers": {
                "cache-header": "app-key token ua wv",
                "app-key": "444e9908a51d1cb236a27862abc769c9",
                "token": self.current_token,
                "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 DingTalk(2.1.5) OS(Windows/10) Browser(Chrome/133.0.0.0) DingWeb/2.1.5 IMPaaS DingWeb/2.1.5",
                "dt": "j",
                "wv": "im:3,au:3,sy:6",
                "sync": "0,0;0;0;",
                "did": self.device_id,
                "mid": generate_mid()
            }
        }
        await ws.send(json.dumps(msg))
        await asyncio.sleep(1)
        msg = {"lwp": "/r/SyncStatus/ackDiff", "headers": {"mid": "5701741704675979 0"}, "body": [
            {"pipeline": "sync", "tooLong2Tag": "PNM,1", "channel": "sync", "topic": "sync", "highPts": 0,
             "pts": int(time.time() * 1000) * 1000, "seq": 0, "timestamp": int(time.time() * 1000)}]}
        await ws.send(json.dumps(msg))
        logger.info('连接注册完成')

    def is_chat_message(self, message):
        try:
            return (
                isinstance(message, dict)
                and "1" in message
                and isinstance(message["1"], dict)
                and "10" in message["1"]
                and isinstance(message["1"]["10"], dict)
                and "reminderContent" in message["1"]["10"]
            )
        except Exception:
            return False

    def is_sync_package(self, message_data):
        try:
            return (
                isinstance(message_data, dict)
                and "body" in message_data
                and "syncPushPackage" in message_data["body"]
                and "data" in message_data["body"]["syncPushPackage"]
                and len(message_data["body"]["syncPushPackage"]["data"]) > 0
            )
        except Exception:
            return False

    def is_typing_status(self, message):
        try:
            return (
                isinstance(message, dict)
                and "1" in message
                and isinstance(message["1"], list)
                and len(message["1"]) > 0
                and isinstance(message["1"][0], dict)
                and "1" in message["1"][0]
                and isinstance(message["1"][0]["1"], str)
                and "@goofish" in message["1"][0]["1"]
            )
        except Exception:
            return False

    def is_system_message(self, message):
        try:
            return (
                isinstance(message, dict)
                and "3" in message
                and isinstance(message["3"], dict)
                and "needPush" in message["3"]
                and message["3"]["needPush"] == "false"
            )
        except Exception:
            return False

    def is_bracket_system_message(self, message):
        try:
            if not message or not isinstance(message, str):
                return False
            clean_message = message.strip()
            if clean_message.startswith('[') and clean_message.endswith(']'):
                logger.debug(f"检测到系统消息: {clean_message}")
                return True
            return False
        except Exception as e:
            logger.error(f"检查系统消息失败: {e}")
            return False

    def check_toggle_keywords(self, message):
        message_stripped = message.strip()
        return message_stripped in self.toggle_keywords

    def is_manual_mode(self, chat_id):
        if chat_id not in self.manual_mode_conversations:
            return False
        current_time = time.time()
        if chat_id in self.manual_mode_timestamps:
            if current_time - self.manual_mode_timestamps[chat_id] > self.manual_mode_timeout:
                self.exit_manual_mode(chat_id)
                return False
        return True

    def enter_manual_mode(self, chat_id):
        self.manual_mode_conversations.add(chat_id)
        self.manual_mode_timestamps[chat_id] = time.time()
        svc = getattr(self, 'session_state_service', None)
        if svc:
            svc.on_manual_toggle(chat_id, True)

    def exit_manual_mode(self, chat_id):
        self.manual_mode_conversations.discard(chat_id)
        if chat_id in self.manual_mode_timestamps:
            del self.manual_mode_timestamps[chat_id]
        svc = getattr(self, 'session_state_service', None)
        if svc:
            svc.on_manual_toggle(chat_id, False)

    def toggle_manual_mode(self, chat_id):
        if self.is_manual_mode(chat_id):
            self.exit_manual_mode(chat_id)
            return "auto"
        else:
            self.enter_manual_mode(chat_id)
            return "manual"

    def format_price(self, price):
        try:
            return round(float(price) / 100, 2)
        except (ValueError, TypeError):
            return 0.0

    def build_item_description(self, item_info):
        clean_skus = []
        raw_sku_list = item_info.get('skuList', [])

        for sku in raw_sku_list:
            specs = [p['valueText'] for p in sku.get('propertyList', []) if p.get('valueText')]
            spec_text = " ".join(specs) if specs else "默认规格"
            clean_skus.append({
                "spec": spec_text,
                "price": self.format_price(sku.get('price', 0)),
                "stock": sku.get('quantity', 0)
            })

        valid_prices = [s['price'] for s in clean_skus if s['price'] > 0]

        if valid_prices:
            min_price = min(valid_prices)
            max_price = max(valid_prices)
            if min_price == max_price:
                price_display = f"¥{min_price}"
            else:
                price_display = f"¥{min_price} - ¥{max_price}"
        else:
            main_price = round(float(item_info.get('soldPrice', 0)), 2)
            price_display = f"¥{main_price}"

        summary = {
            "title": item_info.get('title', ''),
            "desc": item_info.get('desc', ''),
            "price_range": price_display,
            "total_stock": item_info.get('quantity', 0),
            "sku_details": clean_skus
        }

        return json.dumps(summary, ensure_ascii=False)

    async def handle_message(self, message_data, websocket):
        """处理所有类型的消息"""
        try:
            try:
                message = message_data
                ack = {
                    "code": 200,
                    "headers": {
                        "mid": message["headers"]["mid"] if "mid" in message["headers"] else generate_mid(),
                        "sid": message["headers"]["sid"] if "sid" in message["headers"] else '',
                    }
                }
                if 'app-key' in message["headers"]:
                    ack["headers"]["app-key"] = message["headers"]["app-key"]
                if 'ua' in message["headers"]:
                    ack["headers"]["ua"] = message["headers"]["ua"]
                if 'dt' in message["headers"]:
                    ack["headers"]["dt"] = message["headers"]["dt"]
                await websocket.send(json.dumps(ack))
            except Exception:
                pass

            if not self.is_sync_package(message_data):
                return

            sync_data = message_data["body"]["syncPushPackage"]["data"][0]
            if "data" not in sync_data:
                logger.debug("同步包中无data字段")
                return

            try:
                data = sync_data["data"]
                try:
                    decoded_data = base64.b64decode(data).decode("utf-8")
                    json.loads(decoded_data)
                    return
                except Exception:
                    decrypted_data = decrypt(data)
                    message = json.loads(decrypted_data)
            except Exception as e:
                logger.error(f"消息解密失败: {e}")
                return

            try:
                red_reminder = message['3']['redReminder']
                user_id = message['1'].split('@')[0]
                user_url = f'https://www.goofish.com/personal?userId={user_id}'
                if red_reminder == '等待买家付款':
                    logger.info(f'等待买家 {user_url} 付款')
                    return
                if red_reminder == '交易关闭':
                    logger.info(f'买家 {user_url} 交易关闭')
                    return
                if red_reminder == '等待卖家发货':
                    logger.info(f'交易成功 {user_url} 等待卖家发货')
                    return
            except Exception:
                pass

            if self.is_typing_status(message):
                logger.debug("用户正在输入")
                return
            if not self.is_chat_message(message):
                logger.debug("其他非聊天消息")
                logger.debug(f"原始消息: {message}")
                return

            create_time = int(message["1"]["5"])
            send_user_name = message["1"]["10"].get("reminderTitle", "")
            send_user_id = message["1"]["10"].get("senderUserId")
            send_message = message["1"]["10"].get("reminderContent", "")

            if (time.time() * 1000 - create_time) > self.message_expire_time:
                logger.debug("过期消息丢弃")
                return

            url_info = message["1"]["10"].get("reminderUrl", "")
            item_id = url_info.split("itemId=")[1].split("&")[0] if "itemId=" in url_info else None
            chat_id = message["1"]["2"].split('@')[0]

            if not item_id:
                logger.warning("无法获取商品ID")
                return

            event = InboundChatEvent(
                session_id=chat_id,
                item_id=item_id,
                sender_user_id=send_user_id,
                sender_user_name=send_user_name,
                message_text=send_message,
                created_at_ms=create_time,
                source_mode="api",
                raw_payload=message,
            )
            await self.processor.process_event(event)

        except Exception as e:
            logger.error(f"处理消息时发生错误: {str(e)}")
            logger.debug(f"原始消息: {message_data}")
        finally:
            self.ws = websocket

    def build_item_description(self, item_info):
        return self.processor.build_item_description(item_info)

    def format_price(self, price):
        return self.processor.format_price(price)

    @property
    def processor(self):
        return getattr(self, '_processor', None)

    @processor.setter
    def processor(self, value):
        self._processor = value

    async def send_heartbeat(self, ws):
        try:
            heartbeat_mid = generate_mid()
            heartbeat_msg = {
                "lwp": "/!",
                "headers": {
                    "mid": heartbeat_mid
                }
            }
            await ws.send(json.dumps(heartbeat_msg))
            self.last_heartbeat_time = time.time()
            logger.debug("心跳包已发送")
            return heartbeat_mid
        except Exception as e:
            logger.error(f"发送心跳包失败: {e}")
            raise

    async def heartbeat_loop(self, ws):
        while True:
            try:
                current_time = time.time()
                if current_time - self.last_heartbeat_time >= self.heartbeat_interval:
                    await self.send_heartbeat(ws)
                if (current_time - self.last_heartbeat_response) > (self.heartbeat_interval + self.heartbeat_timeout):
                    logger.warning("心跳响应超时，可能连接已断开")
                    break
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"心跳循环出错: {e}")
                break

    async def handle_heartbeat_response(self, message_data):
        try:
            if (
                isinstance(message_data, dict)
                and "headers" in message_data
                and "mid" in message_data["headers"]
                and "code" in message_data
                and message_data["code"] == 200
            ):
                self.last_heartbeat_response = time.time()
                logger.debug("收到心跳响应")
                return True
        except Exception as e:
            logger.error(f"处理心跳响应出错: {e}")
        return False

    async def main(self):
        while True:
            try:
                self.connection_restart_flag = False

                headers = {
                    "Cookie": self.cookies_str,
                    "Host": "wss-goofish.dingtalk.com",
                    "Connection": "Upgrade",
                    "Pragma": "no-cache",
                    "Cache-Control": "no-cache",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
                    "Origin": "https://www.goofish.com",
                    "Accept-Encoding": "gzip, deflate, br, zstd",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }

                async with websockets.connect(self.base_url, extra_headers=headers) as websocket:
                    self.ws = websocket
                    await self.init(websocket)

                    self.last_heartbeat_time = time.time()
                    self.last_heartbeat_response = time.time()

                    self.heartbeat_task = asyncio.create_task(self.heartbeat_loop(websocket))
                    self.token_refresh_task = asyncio.create_task(self.token_refresh_loop())

                    async for message in websocket:
                        try:
                            if self.connection_restart_flag:
                                logger.info("检测到连接重启标志，准备重新建立连接...")
                                break

                            message_data = json.loads(message)

                            if await self.handle_heartbeat_response(message_data):
                                continue

                            if "headers" in message_data and "mid" in message_data["headers"]:
                                ack = {
                                    "code": 200,
                                    "headers": {
                                        "mid": message_data["headers"]["mid"],
                                        "sid": message_data["headers"].get("sid", "")
                                    }
                                }
                                for key in ["app-key", "ua", "dt"]:
                                    if key in message_data["headers"]:
                                        ack["headers"][key] = message_data["headers"][key]
                                await websocket.send(json.dumps(ack))

                            await self.handle_message(message_data, websocket)

                        except json.JSONDecodeError:
                            logger.error("消息解析失败")
                        except Exception as e:
                            logger.error(f"处理消息时发生错误: {str(e)}")
                            logger.debug(f"原始消息: {message}")

            except websockets.exceptions.ConnectionClosed:
                logger.warning("WebSocket连接已关闭")

            except Exception as e:
                logger.error(f"连接发生错误: {e}")

            finally:
                if self.heartbeat_task:
                    self.heartbeat_task.cancel()
                    try:
                        await self.heartbeat_task
                    except asyncio.CancelledError:
                        pass

                if self.token_refresh_task:
                    self.token_refresh_task.cancel()
                    try:
                        await self.token_refresh_task
                    except asyncio.CancelledError:
                        pass

                if self.connection_restart_flag:
                    logger.info("主动重启连接，立即重连...")
                else:
                    logger.info("等待5秒后重连...")
                    await asyncio.sleep(5)
