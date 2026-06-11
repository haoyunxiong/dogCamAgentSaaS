#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_DIR="$ROOT_DIR/electron"
XIANYU_ENV="${XIANYU_ENV:-local}"
XIANYU_ENV_FILE="${XIANYU_ENV_FILE:-$ROOT_DIR/config/environments/$XIANYU_ENV.env}"

if [ ! -f "$XIANYU_ENV_FILE" ]; then
  echo "missing environment config: $XIANYU_ENV_FILE" >&2
  echo "create it from config/environments/$XIANYU_ENV.example.env or choose another XIANYU_ENV." >&2
  exit 1
fi

export ROOT_DIR
set -a
source "$XIANYU_ENV_FILE"
set +a

DEFAULT_NODE_BIN="$(cd "$ROOT_DIR/.." && pwd)/.tools/node-v20.20.2-darwin-arm64/bin/node"
if [ -z "${NODE_BIN:-}" ]; then
  if [ -x "$DEFAULT_NODE_BIN" ]; then
    NODE_BIN="$DEFAULT_NODE_BIN"
  else
    NODE_BIN="$(command -v node)"
  fi
fi
export PATH="$(dirname "$NODE_BIN"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
VITE_PORT="${VITE_PORT:-5177}"
GATEWAY_PORT="${XIANYU_MOBILE_GATEWAY_PORT:-${GATEWAY_PORT:-8787}}"
XIANYU_MOBILE_GATEWAY_HOST="${XIANYU_MOBILE_GATEWAY_HOST:-127.0.0.1}"
XIANYU_MOBILE_GATEWAY_PORT="$GATEWAY_PORT"
LOG_DIR="${XIANYU_LOG_DIR:-/tmp/xianyu-launcher/$XIANYU_ENV}"
LOCK_DIR="$LOG_DIR/desktop-launch-$XIANYU_ENV.lock"
SESSION_PREFIX="xiaogou_${XIANYU_ENV}"

export XIANYU_ENV XIANYU_MOBILE_GATEWAY_HOST XIANYU_MOBILE_GATEWAY_PORT

mkdir -p "$LOG_DIR"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  exit 0
fi

cleanup_lock() {
  rmdir "$LOCK_DIR" >/dev/null 2>&1 || true
}

trap cleanup_lock EXIT

is_listening() {
  local port="$1"
  lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

find_available_port() {
  local start_port="$1"
  local end_port=$((start_port + 49))
  local port="$start_port"
  while [ "$port" -le "$end_port" ]; do
    if ! is_listening "$port"; then
      echo "$port"
      return 0
    fi
    port=$((port + 1))
  done
  return 1
}

ensure_screen_session() {
  local session_name="$1"
  local command="$2"
  if screen -ls | grep -q "\\.${session_name}[[:space:]]"; then
    return 0
  fi
  screen -dmS "$session_name" sh -c "$command"
}

mysql_ready() {
  "$NODE_BIN" - <<'EOF' >/dev/null 2>&1
const mysql = require('mysql2/promise')
const { loadMysqlConfig } = require('./main/mysqlConfig')

async function main() {
  const config = loadMysqlConfig()
  const conn = await mysql.createConnection({ ...config, connectTimeout: 1500 })
  await conn.ping()
  await conn.end()
}

main().catch(() => process.exit(1))
EOF
}

cd "$ELECTRON_DIR"

if ! mysql_ready; then
  osascript -e 'display dialog "数据库当前不可连接，请先确认本机 MySQL 已正常启动后再打开小狗相机助手。" buttons {"知道了"} default button "知道了" with icon stop'
  exit 1
fi

ACTIVE_VITE_PORT="$(find_available_port "$VITE_PORT")"
if [ -z "${ACTIVE_VITE_PORT:-}" ]; then
  osascript -e 'display dialog "未找到可用的前端启动端口（5177-5226）。请关闭占用端口的进程后重试。" buttons {"知道了"} default button "知道了" with icon stop'
  exit 1
fi

if ! is_listening "$GATEWAY_PORT"; then
  ensure_screen_session "${SESSION_PREFIX}_gateway" "$NODE_BIN -e 'const { initDbManager } = require(\"./main/dbManager\"); const { startMobileGateway } = require(\"./main/mobileGateway\"); initDbManager().then(() => startMobileGateway()).then(() => { console.log(\"[standalone-mobile-gateway] ready\"); setInterval(() => {}, 2147483647); }).catch((e) => { console.error(e); process.exit(1); });' 2>&1 | tee \"$LOG_DIR/gateway.log\""
fi

if ! is_listening "$ACTIVE_VITE_PORT"; then
  ensure_screen_session "${SESSION_PREFIX}_vite" "$NODE_BIN ./node_modules/vite/bin/vite.js --config vite.config.js --port $ACTIVE_VITE_PORT --host 127.0.0.1 2>&1 | tee \"$LOG_DIR/vite.log\""
fi

for _ in {1..30}; do
  if is_listening "$ACTIVE_VITE_PORT"; then
    break
  fi
  sleep 1
done

ensure_screen_session "${SESSION_PREFIX}_electron" "VITE_DEV_SERVER_URL=http://localhost:$ACTIVE_VITE_PORT \"$NODE_BIN\" ./node_modules/electron/cli.js . 2>&1 | tee \"$LOG_DIR/electron.log\""

exit 0
