r"""
login_browser.py — CDP-based browser bootstrap helpers for Xianyu.

This module serves two purposes:
1. API mode: launch/reuse a real browser, wait for login, then persist cookies.
2. Browser mode: provide reusable runtime helpers for connecting Playwright over CDP.
"""

import asyncio
import json
import os
import socket
import subprocess
import urllib.request
from typing import Optional

from loguru import logger


REMOTE_DEBUGGING_PORT = 9222
XIANYU_URL = "https://www.goofish.com"
XIANYU_IM_URL = "https://www.goofish.com/im"
COOKIE_DOMAINS = ["goofish.com", "taobao.com", "alipay.com"]


def _cdp_base(port: int) -> str:
    return f"http://localhost:{port}"


def _get_profile_dir() -> str:
    base = os.environ.get("APPDATA", os.path.expanduser("~"))
    profile = os.path.join(base, "XianyuAutoAgent", "browser_profile")
    try:
        os.makedirs(profile, exist_ok=True)
    except OSError as e:
        logger.warning(f"无法创建浏览器 profile 目录，将不使用持久化 profile: {e}")
        return ""
    return profile


def _find_browser() -> str:
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
    ]
    for path in candidates:
        if os.path.isfile(path):
            logger.debug(f"找到浏览器: {path}")
            return path
    raise RuntimeError("未找到 Chrome 或 Edge 浏览器，请安装后重试。")


def _is_port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _launch_browser(exe: str, profile_dir: str, port: int) -> subprocess.Popen:
    args = [
        exe,
        f"--remote-debugging-port={port}",
        "--no-first-run",
        "--no-default-browser-check",
        XIANYU_URL,
    ]
    if profile_dir:
        args.insert(1, f"--user-data-dir={profile_dir}")
    logger.info(f"启动浏览器: {os.path.basename(exe)} (CDP 端口: {port})")
    return subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _cdp_http_get(path: str, timeout: float = 2.0, port: int = REMOTE_DEBUGGING_PORT):
    url = f"{_cdp_base(port)}{path}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


async def _wait_for_cdp(retries: int = 30, interval: float = 1.0, port: int = REMOTE_DEBUGGING_PORT) -> str:
    for attempt in range(retries):
        try:
            targets = _cdp_http_get("/json", port=port)
            for target in targets:
                if target.get("type") == "page" and target.get("webSocketDebuggerUrl"):
                    return target["webSocketDebuggerUrl"]
        except Exception:
            pass
        if attempt < retries - 1:
            await asyncio.sleep(interval)
    raise RuntimeError(
        f"无法连接浏览器调试端口 {port}（等待 {retries}s 超时）。"
        "若浏览器已开启，请确认未被防火墙拦截。"
    )


def resolve_port(config_manager=None, config: Optional[dict] = None, default: int = REMOTE_DEBUGGING_PORT) -> int:
    if config and config.get("BROWSER_REMOTE_DEBUGGING_PORT"):
        try:
            return int(config.get("BROWSER_REMOTE_DEBUGGING_PORT"))
        except (TypeError, ValueError):
            return default
    if config_manager:
        try:
            return int(config_manager.get_value("BROWSER_REMOTE_DEBUGGING_PORT", str(default)))
        except Exception:
            return default
    return default


def resolve_reuse_existing(config_manager=None, config: Optional[dict] = None, default: bool = True) -> bool:
    if config and config.get("BROWSER_USE_EXISTING_CHROME") is not None:
        return str(config.get("BROWSER_USE_EXISTING_CHROME")).strip().lower() == "true"
    if config_manager:
        try:
            value = config_manager.get_value("BROWSER_USE_EXISTING_CHROME", "True" if default else "False")
            return str(value).strip().lower() == "true"
        except Exception:
            return default
    return default


def resolve_auto_launch_browser(config_manager=None, config: Optional[dict] = None, default: bool = False) -> bool:
    if config and config.get("BROWSER_AUTO_LAUNCH") is not None:
        return str(config.get("BROWSER_AUTO_LAUNCH")).strip().lower() == "true"
    if config_manager:
        try:
            value = config_manager.get_value("BROWSER_AUTO_LAUNCH", "True" if default else "False")
            return str(value).strip().lower() == "true"
        except Exception:
            return default
    return default


def resolve_scan_interval_ms(config: Optional[dict], default: int = 2000) -> int:
    try:
        return max(500, int((config or {}).get("BROWSER_POLL_INTERVAL_MS", default)))
    except (TypeError, ValueError):
        return default


def resolve_send_verify_timeout_ms(config: Optional[dict], default: int = 5000) -> int:
    try:
        return max(1000, int((config or {}).get("BROWSER_SEND_VERIFY_TIMEOUT_MS", default)))
    except (TypeError, ValueError):
        return default


def build_browser_runtime_options(config: Optional[dict]) -> dict:
    config = config or {}
    return {
        "port": resolve_port(config=config),
        "reuse_existing": resolve_reuse_existing(config=config),
        "auto_launch": resolve_auto_launch_browser(config=config),
        "scan_interval_ms": resolve_scan_interval_ms(config),
        "send_verify_timeout_ms": resolve_send_verify_timeout_ms(config),
    }


def browser_mode_summary(config: Optional[dict]) -> str:
    options = build_browser_runtime_options(config)
    return (
        f"Browser mode(port={options['port']}, reuse_existing={options['reuse_existing']}, "
        f"auto_launch={options['auto_launch']}, scan_interval_ms={options['scan_interval_ms']}, "
        f"send_verify_timeout_ms={options['send_verify_timeout_ms']})"
    )


def can_reuse_existing_browser(port: int = REMOTE_DEBUGGING_PORT) -> bool:
    if not _is_port_open(port):
        return False
    try:
        _cdp_http_get("/json", timeout=2.0, port=port)
        return True
    except Exception:
        return False


def ensure_debug_browser(port: int = REMOTE_DEBUGGING_PORT, reuse_existing: bool = True, auto_launch: bool = False) -> bool:
    profile_dir = _get_profile_dir()
    if reuse_existing and _is_port_open(port):
        if can_reuse_existing_browser(port):
            logger.debug(f"端口 {port} 已有响应的浏览器，直接复用")
            return True
        logger.error(f"端口 {port} 已被占用但 CDP 无响应，请释放端口后重试")
        return False

    if not reuse_existing and _is_port_open(port):
        logger.error(f"端口 {port} 已被占用，且当前配置不允许复用现有浏览器")
        return False

    if not auto_launch:
        logger.error(
            f"未检测到可复用的 Chrome 调试端口 {port}，且已关闭自动弹出浏览器。"
            f"请先用 --remote-debugging-port={port} 启动 Chrome 并登录闲鱼。"
        )
        return False

    try:
        exe = _find_browser()
    except RuntimeError as e:
        logger.error(str(e))
        return False

    _launch_browser(exe, profile_dir, port)
    return True


def get_debug_http_base(port: int = REMOTE_DEBUGGING_PORT) -> str:
    return _cdp_base(port)


def get_xianyu_im_url() -> str:
    return XIANYU_IM_URL


def get_xianyu_home_url() -> str:
    return XIANYU_URL


def get_cookie_domains() -> list:
    return COOKIE_DOMAINS


def get_default_remote_debugging_port() -> int:
    return REMOTE_DEBUGGING_PORT


def build_browser_profile_dir() -> str:
    return _get_profile_dir()


def is_debug_port_open(port: int = REMOTE_DEBUGGING_PORT) -> bool:
    return _is_port_open(port)


async def _open_new_tab(port: int = REMOTE_DEBUGGING_PORT) -> str:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: _open_new_tab_http(port))


def _open_new_tab_http(port: int = REMOTE_DEBUGGING_PORT) -> str:
    url = f"{_cdp_base(port)}/json/new?{XIANYU_URL}"
    req = urllib.request.Request(url, method="PUT")
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        target = json.loads(resp.read().decode())
    ws_url = target.get("webSocketDebuggerUrl")
    if not ws_url:
        raise RuntimeError("新标签页没有返回 webSocketDebuggerUrl")
    return ws_url


async def open_xianyu_im_page(port: int = REMOTE_DEBUGGING_PORT) -> str:
    await _wait_for_cdp(retries=30, interval=1.0, port=port)
    return await _open_new_tab(port)


async def _cdp_call(ws, method: str, params: Optional[dict] = None, msg_id: int = 1) -> dict:
    payload = {"id": msg_id, "method": method, "params": params or {}}
    await ws.send(json.dumps(payload))
    while True:
        raw = await ws.recv()
        msg = json.loads(raw)
        if msg.get("id") == msg_id:
            return msg.get("result", {})


async def _get_all_cookies(ws, msg_id_start: int = 10) -> list:
    result = await _cdp_call(ws, "Network.getAllCookies", msg_id=msg_id_start)
    return result.get("cookies", [])


def _extract_cookie_str(cookies: list) -> str:
    relevant = [
        cookie for cookie in cookies
        if any(domain in cookie.get("domain", "") for domain in COOKIE_DOMAINS)
    ]
    return "; ".join(f"{cookie['name']}={cookie['value']}" for cookie in relevant)


def extract_cookies_from_cookie_header(cookies_str: str) -> dict:
    result = {}
    for part in cookies_str.split(";"):
        part = part.strip()
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        result[key.strip()] = value.strip()
    return result


def has_login_cookie(cookies_str: str) -> bool:
    cookies = extract_cookies_from_cookie_header(cookies_str)
    return bool(cookies.get("unb"))


async def browser_login(config_manager, config: Optional[dict] = None) -> bool:
    current_config = config or (config_manager.get_config() if config_manager else {})
    options = build_browser_runtime_options(current_config)
    port = options["port"]
    reuse_existing = options["reuse_existing"]

    logger.info(f"准备浏览器登录: {browser_mode_summary(current_config)}")
    if not ensure_debug_browser(port=port, reuse_existing=reuse_existing, auto_launch=options["auto_launch"]):
        return False

    try:
        await _wait_for_cdp(retries=30, interval=1.0, port=port)
        new_tab_ws_url = await _open_new_tab(port)
    except RuntimeError as e:
        logger.error(str(e))
        return False

    try:
        import websockets

        async with websockets.connect(new_tab_ws_url) as ws:
            msg_id = 1
            await _cdp_call(ws, "Network.enable", msg_id=msg_id)
            msg_id += 1
            await _cdp_call(ws, "Page.navigate", {"url": XIANYU_URL}, msg_id=msg_id)
            msg_id += 1
            logger.info("已打开闲鱼首页，请在浏览器中扫码登录（最多等待 120 秒）…")

            max_wait = 120
            poll_interval = 2
            elapsed = 0

            while elapsed <= max_wait - poll_interval:
                await asyncio.sleep(poll_interval)
                elapsed += poll_interval

                cookies = await _get_all_cookies(ws, msg_id_start=msg_id)
                msg_id += 1
                cookie_str = _extract_cookie_str(cookies)

                if has_login_cookie(cookie_str):
                    if config_manager:
                        config_manager.update_cookies(cookie_str)
                    logger.info("Cookie 已保存，跳转到消息列表页")
                    await _cdp_call(ws, "Page.navigate", {"url": XIANYU_IM_URL}, msg_id=msg_id)
                    return True

            logger.warning("等待扫码超时（120 秒），请重新启动后再试")
            return False

    except Exception as e:
        logger.error(f"CDP 登录异常: {e}")
        return False
