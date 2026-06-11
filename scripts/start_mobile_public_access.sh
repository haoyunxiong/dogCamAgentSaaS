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
GATEWAY_PORT="${XIANYU_MOBILE_GATEWAY_PORT:-${GATEWAY_PORT:-8787}}"
XIANYU_MOBILE_GATEWAY_HOST="${XIANYU_MOBILE_GATEWAY_HOST:-127.0.0.1}"
XIANYU_MOBILE_GATEWAY_PORT="$GATEWAY_PORT"
NGROK_API="http://127.0.0.1:4040/api/tunnels"
NGROK_BIN="$ELECTRON_DIR/.codex-bin/ngrok/ngrok"
NGROK_LOG="${XIANYU_NGROK_LOG:-/tmp/xiaogou-ngrok-$XIANYU_ENV.log}"
SESSION_PREFIX="xiaogou_${XIANYU_ENV}"

export XIANYU_ENV XIANYU_MOBILE_GATEWAY_HOST XIANYU_MOBILE_GATEWAY_PORT

is_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

ensure_screen_session() {
  local session_name="$1"
  local command="$2"
  if screen -ls | grep -q "\\.${session_name}[[:space:]]"; then
    return 0
  fi
  screen -dmS "$session_name" sh -c "$command"
}

start_gateway_if_needed() {
  if is_listening "$GATEWAY_PORT"; then
    return 0
  fi
  cd "$ELECTRON_DIR"
  ensure_screen_session "${SESSION_PREFIX}_gateway" "$NODE_BIN -e 'const { initDbManager } = require(\"./main/dbManager\"); const { startMobileGateway } = require(\"./main/mobileGateway\"); initDbManager().then(() => startMobileGateway()).then(() => { console.log(\"[standalone-mobile-gateway] ready\"); setInterval(() => {}, 2147483647); }).catch((e) => { console.error(e); process.exit(1); });'"
  for _ in {1..20}; do
    if is_listening "$GATEWAY_PORT"; then
      return 0
    fi
    sleep 1
  done
  echo "mobile gateway did not start on port $GATEWAY_PORT" >&2
  exit 1
}

start_ngrok_if_needed() {
  if [ ! -x "$NGROK_BIN" ]; then
    echo "missing ngrok binary: $NGROK_BIN" >&2
    exit 1
  fi
  if curl -sf "$NGROK_API" >/dev/null 2>&1; then
    return 0
  fi
  ensure_screen_session "${SESSION_PREFIX}_ngrok" "$NGROK_BIN http $GATEWAY_PORT --log stdout --log-format logfmt 2>&1 | tee \"$NGROK_LOG\""
  for _ in {1..20}; do
    if curl -sf "$NGROK_API" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "ngrok api did not become ready at $NGROK_API" >&2
  exit 1
}

print_urls() {
  local tunnel_json
  tunnel_json="$(curl -sf "$NGROK_API")"
  local public_url
  public_url="$("$NODE_BIN" -e 'const fs = require("fs"); const input = fs.readFileSync(0, "utf8"); const data = JSON.parse(input); const url = (data.tunnels || []).find((item) => item.proto === "https")?.public_url || ""; process.stdout.write(url);' <<<"$tunnel_json")"
  if [ -z "$public_url" ]; then
    echo "ngrok is running but no https tunnel was found" >&2
    exit 1
  fi

  echo "公网访问地址:"
  echo "  $public_url/mobile"
  echo
  echo "可用于飞书回调的基础地址:"
  echo "  $public_url"
}

start_gateway_if_needed
start_ngrok_if_needed
print_urls
