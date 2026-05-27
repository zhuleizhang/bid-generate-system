#!/bin/bash
set -e

cd "$(dirname "$0")"

REQ_HASH_FILE="venv/.requirements.sha256"

if [ ! -d "venv" ]; then
    echo "==> 创建虚拟环境..."
    python3 -m venv venv
fi

echo "==> 激活虚拟环境..."
source venv/bin/activate

CURRENT_REQ_HASH="$(shasum -a 256 requirements.txt | awk '{print $1}')"
INSTALLED_REQ_HASH=""

if [ -f "$REQ_HASH_FILE" ]; then
    INSTALLED_REQ_HASH="$(cat "$REQ_HASH_FILE")"
fi

if [ "$CURRENT_REQ_HASH" != "$INSTALLED_REQ_HASH" ]; then
    echo "==> 安装/更新依赖..."
    pip install -r requirements.txt
    echo "$CURRENT_REQ_HASH" > "$REQ_HASH_FILE"
else
    echo "==> 依赖已是最新，跳过安装"
fi

echo "==> 启动 FastAPI 服务..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
