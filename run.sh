#!/usr/bin/env bash
# SkillPath AI - Quick Start Script

set -e

PORT=${1:-8000}
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=========================================================="
echo "⚡ Starting SkillPath AI Server on http://localhost:${PORT}"
echo "=========================================================="
echo "Open your browser to: http://localhost:${PORT}"
echo "Press Ctrl+C to stop the server."
echo ""

cd "$DIR/backend"
python3 server.py "$PORT"
