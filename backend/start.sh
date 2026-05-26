#!/bin/bash
set -e

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "==> 创建虚拟环境..."
    python3 -m venv venv
fi

echo "==> 激活虚拟环境..."
source venv/bin/activate

if [ ! -f "venv/.deps_installed" ]; then
    echo "==> 安装依赖..."
    pip install -r requirements.txt
    touch venv/.deps_installed
fi

echo "==> 启动 FastAPI 服务..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
