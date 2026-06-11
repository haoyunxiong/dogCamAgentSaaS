#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
XIANYU_ENV=production exec "$SCRIPT_DIR/start_xianyu_desktop.sh"
