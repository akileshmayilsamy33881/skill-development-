#!/usr/bin/env bash
# SkillPath AI - Full Stack Launcher

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export PATH="$HOME/.local/node/bin:$PATH"

echo "=========================================================="
echo "⚡ Starting SkillPath AI (React + Vite + Python Agents)"
echo "=========================================================="

# Build React frontend
if [ -d "$DIR/frontend-react" ]; then
  echo "Building React + Vite frontend..."
  cd "$DIR/frontend-react"
  npm run build
fi

cd "$DIR/backend"
echo ""
echo "Serving React + Vite application at: http://localhost:8000"
echo "Press Ctrl+C to stop."
python3 server.py 8000
