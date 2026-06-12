#!/usr/bin/env bash
# Pixel Agents 安定起動スクリプト
# - stdin を /dev/null に切り離す (Vite の TTY EIO クラッシュ防止)
# - setsid で親シェルから完全分離 (シェル終了で道連れに死なない)
# - 既存プロセスを安全に停止してから起動

set -u
cd "$(dirname "$0")"

LOG_FILE="/tmp/vite-pixel.log"
PID_FILE="/tmp/vite-pixel.pid"
PORT="${VITE_PORT:-5180}"

# 既存プロセス停止
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[start-dev] Stopping existing PID $OLD_PID"
    kill -TERM "$OLD_PID" 2>/dev/null || true
    sleep 1
    kill -KILL "$OLD_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

# 指定ポートを掴んでいる別プロセスを kill (OrbStack 等)
EXISTING=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
  echo "[start-dev] Killing PID(s) on port $PORT: $EXISTING"
  echo "$EXISTING" | xargs kill -TERM 2>/dev/null || true
  sleep 1
fi

echo "[start-dev] Starting Vite on port $PORT, log=$LOG_FILE"

# nohup + stdin /dev/null + disown で親シェルから分離
# (macOS には setsid 無し。disown が同等の役割を果たす)
nohup npm run dev </dev/null > "$LOG_FILE" 2>&1 &
PID=$!
disown "$PID" 2>/dev/null || true
echo "$PID" > "$PID_FILE"

sleep 3
if kill -0 "$PID" 2>/dev/null; then
  echo "[start-dev] Started: PID=$PID"
  echo "[start-dev] Tail log: tail -f $LOG_FILE"
else
  echo "[start-dev] FAILED to start. Log:"
  cat "$LOG_FILE"
  exit 1
fi
