"""
bridge.py — IPC bridge between Electron and the XianyuAutoAgent Python backend.

Communication protocol: JSON lines on stdout (to Electron) / stdin (from Electron).

Outbound message types:
  {"type": "log",                    "level": "info|debug|warning|error", "message": "...", "time": "ISO"}
  {"type": "status",                 "running": true|false}
  {"type": "error",                  "code": "...", "message": "..."}
  {"type": "generate_prompts_result","success": true|false, "prompts": {...}, "message": "..."}

Inbound commands:
  {"cmd": "start"}
  {"cmd": "stop"}
  {"cmd": "reload_config"}
  {"cmd": "generate_prompts", "chat_log": "..."}
"""

import asyncio
import json
import os
import sys
import threading

# Force UTF-8 stdout/stderr on Windows (prevents GBK encoding issues)
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

from loguru import logger


# ---------------------------------------------------------------------------
# Resource path helper (PyInstaller compatibility)
# ---------------------------------------------------------------------------

def get_resource_path(rel: str) -> str:
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, rel)
    return os.path.join(os.path.dirname(__file__), rel)


# ---------------------------------------------------------------------------
# Data directory
# ---------------------------------------------------------------------------

def get_data_dir() -> str:
    # Prefer XIANYU_DATA_DIR env (set by Electron), then E:\XianyuAgentData, fallback APPDATA
    custom = os.environ.get('XIANYU_DATA_DIR', '')
    if custom and os.path.isdir(custom):
        return custom
    preferred = r'E:\XianyuAgentData'
    try:
        os.makedirs(preferred, exist_ok=True)
        return preferred
    except OSError:
        pass
    appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
    data_dir = os.path.join(appdata, 'XianyuAutoAgent')
    os.makedirs(data_dir, exist_ok=True)
    return data_dir


# ---------------------------------------------------------------------------
# Stdout JSON sink for loguru
# ---------------------------------------------------------------------------

def stdout_json_sink(message):
    record = message.record
    payload = {
        "type": "log",
        "level": record["level"].name.lower(),
        "message": record["message"],
        "time": record["time"].isoformat(),
    }
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def emit_status(running: bool):
    payload = {"type": "status", "running": running}
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def emit_error(code: str, message: str):
    payload = {"type": "error", "code": code, "message": message}
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def emit_generate_prompts_result(success: bool, prompts: dict = None, message: str = ""):
    payload = {
        "type": "generate_prompts_result",
        "success": success,
        "prompts": prompts or {},
        "message": message,
    }
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


# ---------------------------------------------------------------------------
# Stdin reader thread (Windows asyncio stdin not reliable)
# ---------------------------------------------------------------------------

def stdin_thread(cmd_queue: asyncio.Queue, loop: asyncio.AbstractEventLoop):
    for line in sys.stdin:
        line = line.strip()
        if line:
            try:
                cmd = json.loads(line)
                loop.call_soon_threadsafe(cmd_queue.put_nowait, cmd)
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Bridge main
# ---------------------------------------------------------------------------

class BridgeManager:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.config_db_path = os.path.join(data_dir, 'app_config.db')
        self.chat_db_path = os.path.join(data_dir, 'chat_history.db')
        self.config_manager = None
        self.bot_task: asyncio.Task = None
        self.generate_task: asyncio.Task = None
        self.knowledge_task: asyncio.Task | None = None
        self.learning_task: asyncio.Task | None = None
        self._market_task: asyncio.Task | None = None
        self._market_scheduler = None
        self._feishu_pending_store = None
        self._feishu_callback_server = None
        self.knowledge_manager: 'KnowledgeManager | None' = None
        self.knowledge_retriever: 'KnowledgeRetriever | None' = None
        self._active_bot: 'XianyuReplyBot | None' = None
        self._learning_service: 'LearningService | None' = None
        self._rental_repository = None
        self._context_manager = None
        self._live = None
        self._bot = None
        self._config = None
        self._prompt_overrides = None
        self._cookies_str = None

    def load_modules(self):
        """Import project modules (supports both source and PyInstaller bundle)."""
        # Ensure the package directory is on sys.path
        pkg_dir = get_resource_path('.')
        if pkg_dir not in sys.path:
            sys.path.insert(0, pkg_dir)

    def init_config(self):
        from config_manager import AppConfigManager
        prompt_dir = get_resource_path('prompts')
        self.config_manager = AppConfigManager(self.config_db_path)
        self.config_manager.seed_defaults(prompt_dir)
        logger.info("配置管理器初始化完成")

        from knowledge_base import KnowledgeManager, KnowledgeRetriever
        config = self.config_manager.get_config()
        # 必须先注入 DB_PATH，KnowledgeManager/KnowledgeRetriever 构造函数会直接访问 config["DB_PATH"]
        config["DB_PATH"] = self.config_manager.db_path
        self.knowledge_manager = KnowledgeManager(config)
        self.knowledge_retriever = KnowledgeRetriever(config)

    def build_live_instance(self):
        """Instantiate channel runner and shared bot/context from current DB config."""
        from main import XianyuLive
        from XianyuAgent import XianyuReplyBot
        from context_manager import ChatContextManager
        from services import LearningService, RentalRepository
        from channels import BrowserRunner

        config = self.config_manager.get_config()
        prompt_overrides = self.config_manager.get_all_prompts()
        channel_mode = (config.get("CHANNEL_MODE", "api") or "api").strip().lower()

        if not config.get("API_KEY", ""):
            raise ValueError("API_KEY 未配置，请在设置页面填写 API Key")

        cookies_str = config.get("COOKIES_STR", "")
        if channel_mode == "api" and not cookies_str:
            raise ValueError("COOKIES_STR 未配置，请在设置页面填写 Cookie")

        bot = XianyuReplyBot(config=config, prompt_overrides=prompt_overrides)
        self._active_bot = bot
        context_manager = ChatContextManager(db_path=self.chat_db_path)

        if channel_mode == "browser":
            live = BrowserRunner(
                config=config,
                config_manager=self.config_manager,
                context_manager=context_manager,
                bot=bot,
                knowledge_retriever=self.knowledge_retriever,
            )
        else:
            live = XianyuLive(
                cookies_str=cookies_str,
                config=config,
                config_manager=self.config_manager,
                knowledge_retriever=self.knowledge_retriever,
            )
            live.set_context_manager(context_manager)
            live.set_bot(bot)

        self._config = config
        self._prompt_overrides = prompt_overrides
        self._cookies_str = cookies_str
        self._context_manager = context_manager
        self._live = live
        self._bot = bot
        self._rental_repository = RentalRepository(self.config_db_path, self.chat_db_path)
        self._learning_service = LearningService(self._rental_repository, config=self._config)

        from services import FeishuPendingReplyStore
        self._feishu_pending_store = FeishuPendingReplyStore(self.config_db_path)

        return live

    async def start_bot(self):
        if self.bot_task and not self.bot_task.done():
            logger.warning("机器人已在运行中")
            return

        try:
            logger.info("正在启动机器人...")

            channel_mode = (self.config_manager.get_config().get("CHANNEL_MODE", "api") or "api").strip().lower()
            if channel_mode == "api":
                from login_browser import browser_login
                logger.info("正在通过 CDP 浏览器刷新 Cookie…")
                success = await browser_login(self.config_manager)
                if not success:
                    logger.error("CDP 登录失败，机器人未启动。请重试。")
                    emit_status(False)
                    return
                logger.info("CDP 登录成功，继续启动机器人")
            else:
                logger.info("当前为 Browser 模式，跳过 API Cookie 刷新")

            live = self.build_live_instance()
            self.bot_task = asyncio.create_task(live.main())
            emit_status(True)
            logger.info("机器人已启动")

            # Wait for task and handle completion / errors
            try:
                await self.bot_task
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.error(f"机器人运行异常: {e}")
                emit_error("BOT_ERROR", str(e))
            finally:
                emit_status(False)
                logger.info("机器人已停止")

        except Exception as e:
            logger.error(f"机器人启动失败: {e}")
            emit_error("START_FAILED", str(e))
            emit_status(False)

    async def stop_bot(self):
        if not self.bot_task or self.bot_task.done():
            emit_status(False)
            return

        logger.info("正在停止机器人...")
        if hasattr(self._live, 'stop'):
            try:
                self._live.stop()
            except Exception as e:
                logger.warning(f"停止 runner 时发生异常: {e}")
        self.bot_task.cancel()
        try:
            await asyncio.wait_for(asyncio.shield(self.bot_task), timeout=5.0)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            pass
        emit_status(False)
        logger.info("机器人已停止")

    async def handle_generate_prompts(self, chat_log: str):
        logger.info("正在调用 AI 分析聊天记录，生成提示词…")
        try:
            from openai import AsyncOpenAI
            config = self.config_manager.get_config()
            client = AsyncOpenAI(
                api_key=config.get("API_KEY", ""),
                base_url=config.get("MODEL_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
            )
            model = config.get("MODEL_NAME", "qwen-max")

            system_prompt = (
                "你是一个咸鱼（闲鱼）智能客服提示词生成专家。\n"
                "用户会提供一段买卖双方的聊天记录。\n"
                "请根据聊天记录中卖家的回复风格、议价策略和专业知识，"
                "为以下 4 个角色分别生成一段高质量的系统提示词（system prompt）：\n"
                "1. classify_prompt：意图分类 Agent，判断用户消息属于 price/tech/default 哪种意图\n"
                "2. price_prompt：价格谈判 Agent，负责礼貌但坚定地处理砍价\n"
                "3. tech_prompt：技术咨询 Agent，负责回答商品的技术/使用问题\n"
                "4. default_prompt：默认回复 Agent，处理其他通用咨询\n\n"
                "输出格式必须严格为如下 JSON（不要包含任何其他文字）：\n"
                '{"classify_prompt": "...", "price_prompt": "...", "tech_prompt": "...", "default_prompt": "..."}'
            )

            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"以下是聊天记录：\n\n{chat_log}"},
                ],
                temperature=0.5,
                max_tokens=2000,
            )

            raw = response.choices[0].message.content.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                lines = raw.splitlines()
                # Remove opening fence line (```json or ```)
                lines = lines[1:]
                # Remove closing fence line if present
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                raw = "\n".join(lines).strip()
            prompts = json.loads(raw)

            required = {"classify_prompt", "price_prompt", "tech_prompt", "default_prompt"}
            if not required.issubset(prompts.keys()):
                raise ValueError(f"AI 返回字段缺失: {required - prompts.keys()}")

            logger.info("AI 提示词生成成功")
            emit_generate_prompts_result(True, prompts)

        except Exception as e:
            logger.error(f"AI 提示词生成失败: {e}")
            emit_generate_prompts_result(False, message=str(e))

    async def run(self):
        loop = asyncio.get_running_loop()
        cmd_queue: asyncio.Queue = asyncio.Queue()

        # Start stdin reader thread
        t = threading.Thread(target=stdin_thread, args=(cmd_queue, loop), daemon=True)
        t.start()

        logger.info("Bridge 已就绪，等待指令...")
        emit_status(False)

        # Command dispatch loop
        start_task = None

        while True:
            try:
                cmd = await asyncio.wait_for(cmd_queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue

            action = cmd.get("cmd", "")

            if action == "start":
                if start_task and not start_task.done():
                    logger.warning("机器人已在运行中，忽略重复 start 命令")
                else:
                    start_task = asyncio.create_task(self.start_bot())

            elif action == "stop":
                if start_task and not start_task.done():
                    start_task.cancel()
                    try:
                        await asyncio.wait_for(asyncio.shield(start_task), timeout=6.0)
                    except (asyncio.CancelledError, asyncio.TimeoutError):
                        pass
                await self.stop_bot()
                start_task = None

            elif action == "reload_config":
                logger.info("收到 reload_config 指令，重新加载配置...")
                was_running = start_task and not start_task.done()
                if was_running and self._active_bot is not None:
                    # Hot-reload prompts without restarting the bot
                    prompt_overrides = self.config_manager.get_all_prompts()
                    self._active_bot.reload_prompts(prompt_overrides)
                    logger.info("提示词已热更新，机器人继续运行")
                else:
                    # Bot not running — just refresh config_manager so next start uses new values
                    self.init_config()

            elif action == "generate_prompts":
                chat_log = cmd.get("chat_log", "")
                if not chat_log.strip():
                    emit_generate_prompts_result(False, message="聊天记录不能为空")
                elif not self.generate_task or self.generate_task.done():
                    self.generate_task = asyncio.create_task(
                        self.handle_generate_prompts(chat_log)
                    )
                else:
                    logger.warning("AI 生成已在进行中，忽略重复请求")

            elif action == "knowledge:rebuild_index":
                if not self.knowledge_task or self.knowledge_task.done():
                    self.knowledge_task = asyncio.create_task(
                        self._handle_rebuild_index()
                    )
                else:
                    logger.debug("[knowledge] 索引重建已在进行中，忽略重复请求")

            elif action == "knowledge:generate_from_image":
                image_path = cmd.get("image_path", "")
                if not image_path:
                    self._emit_knowledge_error("image_path 不能为空")
                elif not self.knowledge_task or self.knowledge_task.done():
                    self.knowledge_task = asyncio.create_task(
                        self._handle_generate_from_image(image_path)
                    )
                else:
                    self._emit_knowledge_error("AI 生成已在进行中，请稍后再试")

            elif action == "knowledge:generate_from_chat":
                chat_text = cmd.get("chat_text", "")
                if not chat_text.strip():
                    self._emit_knowledge_error("聊天记录不能为空")
                elif not self.knowledge_task or self.knowledge_task.done():
                    self.knowledge_task = asyncio.create_task(
                        self._handle_generate_from_chat(chat_text)
                    )
                else:
                    self._emit_knowledge_error("AI 生成已在进行中，请稍后再试")

            elif action == "learning:extract_history":
                limit = cmd.get("limit")
                if not self.learning_task or self.learning_task.done():
                    self.learning_task = asyncio.create_task(
                        self._handle_extract_history(limit)
                    )
                else:
                    logger.warning("历史学习抽取已在进行中，忽略重复请求")

            elif action == "browser:sync_history":
                limit = cmd.get("limit")
                mode = cmd.get("mode") or "current"
                if not self.learning_task or self.learning_task.done():
                    self.learning_task = asyncio.create_task(
                        self._handle_browser_sync_history(limit, mode)
                    )
                else:
                    logger.warning("浏览器历史同步已在进行中，忽略重复请求")

            elif action == "item:mark_detail_dirty":
                item_id = cmd.get("item_id")
                reason = cmd.get("reason") or "manual"
                self._handle_mark_item_detail_dirty(item_id, reason)

            elif action == "notify:order":
                payload = cmd.get("payload") or {}
                self._handle_order_notification(payload)

            elif action == "market:scan":
                model_codes = cmd.get("modelCodes") or []
                if not self._market_task or self._market_task.done():
                    self._market_task = asyncio.create_task(
                        self._handle_market_scan(model_codes)
                    )
                else:
                    logger.warning("市场扫描已在进行中，忽略重复请求")

            elif action == "feishu:send_approved_reply":
                payload = cmd.get("payload") or {}
                asyncio.create_task(self._handle_send_approved_reply(payload))

            else:
                logger.warning(f"未知命令: {action}")


    def _emit_knowledge_error(self, message: str):
        payload = {"type": "knowledge_generate_error", "message": message}
        sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    async def _handle_market_scan(self, model_codes=None):
        """执行市场扫描。"""
        try:
            from services import MarketMonitorStore, MarketMonitorBrowser, MarketMonitorAPI
            config = self.config_manager.get_config()
            store = MarketMonitorStore(self.config_db_path)
            channel_mode = (config.get("CHANNEL_MODE", "api") or "api").strip().lower()

            if channel_mode == "browser":
                monitor = MarketMonitorBrowser(store, config)
            else:
                monitor = MarketMonitorAPI(store, config)

            def on_progress(msg):
                logger.info(f"[market] {msg}")

            results = await monitor.scan_all(on_progress=on_progress)
            payload = {"type": "market_scan_result", "success": True, "data": results}
            sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
            sys.stdout.flush()

            # 发送告警到飞书
            from services import NotificationService, RentalRepository
            if self._rental_repository is None:
                self._rental_repository = RentalRepository(self.config_db_path, self.chat_db_path)
            notifier = NotificationService(self._rental_repository)
            for r in results:
                anomaly = r.get("anomaly")
                if anomaly:
                    logger.warning(f"[market] 价格异动: {anomaly['model_code']} - {anomaly['alert_message']}")

        except Exception as e:
            logger.error(f"[market] 扫描失败: {e}")
            payload = {"type": "market_scan_result", "success": False, "message": str(e)}
            sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
            sys.stdout.flush()

    async def _handle_send_approved_reply(self, payload):
        """处理飞书确认后的回复发送。"""
        try:
            session_id = payload.get("session_id")
            final_reply = payload.get("final_reply")
            if not session_id or not final_reply:
                logger.warning("[feishu] 确认回复缺少 session_id 或 final_reply")
                return

            if self._live and hasattr(self._live, 'send_msg_by_session'):
                await self._live.send_msg_by_session(session_id, final_reply)
                logger.info(f"[feishu] 已发送确认回复到会话 {session_id}: {final_reply[:50]}")
                # 飞书审批通过 → 重置会话状态为 auto，并登记 bot 已发签名
                svc = getattr(self._live, 'session_state_service', None)
                if svc:
                    svc.mark_bot_sent(session_id, final_reply)
                    svc.on_feishu_approved(session_id)
            else:
                logger.warning("[feishu] 机器人未运行，无法发送确认回复")
        except Exception as e:
            logger.error(f"[feishu] 发送确认回复失败: {e}")

    async def _handle_rebuild_index(self):
        if self.knowledge_manager is None:
            self._emit_knowledge_error("知识库未初始化")
            return
        try:
            await self.knowledge_manager.rebuild_index()
            self.knowledge_retriever.invalidate_cache()
            sys.stdout.write(json.dumps({"type": "knowledge_rebuild_result", "success": True}) + "\n")
            sys.stdout.flush()
        except Exception as e:
            logger.error(f"[knowledge] 索引重建失败: {e}")
            self._emit_knowledge_error(str(e))

    def _handle_mark_item_detail_dirty(self, item_id: str, reason: str):
        if not item_id:
            return
        try:
            context_manager = self._context_manager
            if context_manager is None:
                from context_manager import ChatContextManager
                context_manager = ChatContextManager(db_path=self.chat_db_path)
            ok = context_manager.mark_item_info_dirty(item_id, reason=reason)
            payload = {"type": "item_detail_dirty_result", "success": bool(ok), "item_id": item_id, "reason": reason}
            sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
            sys.stdout.flush()
        except Exception as e:
            logger.error(f"[item-detail] 标记脏数据失败: {e}")

    async def _handle_generate_from_image(self, image_path: str):
        if self.knowledge_manager is None:
            self._emit_knowledge_error("知识库未初始化")
            return
        try:
            result = await self.knowledge_manager.generate_from_image(image_path)
            payload = {"type": "knowledge_generate_result", "data": result}
            sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
            sys.stdout.flush()
        except Exception as e:
            logger.error(f"[knowledge] 图片生成 Q&A 失败: {e}")
            self._emit_knowledge_error(str(e))

    async def _handle_generate_from_chat(self, chat_text: str):
        if self.knowledge_manager is None:
            self._emit_knowledge_error("知识库未初始化")
            return
        try:
            result = await self.knowledge_manager.generate_from_chat_log(chat_text)
            payload = {"type": "knowledge_generate_result", "data": result}
            sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
            sys.stdout.flush()
        except Exception as e:
            logger.error(f"[knowledge] 聊天记录生成 Q&A 失败: {e}")
            self._emit_knowledge_error(str(e))

    async def _handle_extract_history(self, limit):
        if self._learning_service is None:
            try:
                from services import LearningService, RentalRepository
                self._rental_repository = RentalRepository(self.config_db_path, self.chat_db_path)
                self._learning_service = LearningService(self._rental_repository, config=getattr(self, '_config', None))
            except Exception as e:
                payload = {"type": "history_learning_result", "success": False, "message": str(e)}
                sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
                sys.stdout.flush()
                return
        try:
            parsed_limit = int(limit) if limit not in (None, "") else None
        except (TypeError, ValueError):
            parsed_limit = None
        try:
            result = self._learning_service.extract_from_history(limit=parsed_limit)
            payload = {"type": "history_learning_result", "success": True, "data": result}
            sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
            sys.stdout.flush()
        except Exception as e:
            logger.error(f"[learning] 历史聊天抽取失败: {e}")
            payload = {"type": "history_learning_result", "success": False, "message": str(e)}
            sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
            sys.stdout.flush()

    async def _handle_browser_sync_history(self, limit, mode: str = "current"):
        try:
            parsed_limit = int(limit) if limit not in (None, "") else None
        except (TypeError, ValueError):
            parsed_limit = None
        if mode not in ("current", "sweep"):
            mode = "current"

        try:
            if self._live is None or not hasattr(self._live, 'sync_visible_history'):
                raise RuntimeError("请先以浏览器模式启动机器人，再执行历史同步")
            result = await self._live.sync_visible_history(limit=parsed_limit, mode=mode)
            payload = {"type": "browser_history_sync_result", "success": True, "data": result}
            sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
            sys.stdout.flush()
        except Exception as e:
            logger.error(f"[browser] 历史同步失败: {e}")
            payload = {"type": "browser_history_sync_result", "success": False, "message": str(e)}
            sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
            sys.stdout.flush()

    def _handle_order_notification(self, payload):
        try:
            from services import NotificationService, RentalRepository
            if self._rental_repository is None:
                self._rental_repository = RentalRepository(self.config_db_path, self.chat_db_path)
            notifier = NotificationService(self._rental_repository)
            notifier.notify_order(payload)
        except Exception as e:
            logger.error(f"[notify] 订单通知失败: {e}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    # Set BRIDGE_MODE env so downstream code knows it's running under Electron
    os.environ['BRIDGE_MODE'] = '1'

    # Setup loguru: remove default stderr handler, add JSON stdout sink + file sink
    logger.remove()
    logger.add(stdout_json_sink, level="DEBUG")

    # File sink: rotate daily, keep 7 days, UTF-8, stored in %APPDATA%\XianyuAutoAgent\logs\
    log_dir = os.path.join(get_data_dir(), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    logger.add(
        os.path.join(log_dir, 'system-{time:YYYY-MM-DD}.log'),
        level="DEBUG",
        encoding="utf-8",
        rotation="00:00",       # new file each day at midnight
        retention="7 days",     # keep logs for 7 days
        format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {message}",
        enqueue=True,           # thread-safe async write
    )

    data_dir = get_data_dir()
    manager = BridgeManager(data_dir)
    manager.load_modules()
    manager.init_config()

    try:
        asyncio.run(manager.run())
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
