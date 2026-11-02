#!/usr/bin/env bash
# Test mineflayer-boat against multiple Minecraft versions in Docker

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

VERSION="${1:-1.21.4}"
PORT=25599
TIMEOUT=120

case "$VERSION" in
  1.21.4)
    CONTAINER="mineflayer-boat-1.21.4"
    ;;
  26.1)
    CONTAINER="mineflayer-boat-26.1"
    PORT=25600
    ;;
  *)
    echo "Unknown version: $VERSION"
    exit 1
    ;;
esac

echo "🚀 Starting Minecraft $VERSION in Docker..."
docker compose up -d "$CONTAINER"

echo "⏳ Waiting for server to be ready (max ${TIMEOUT}s)..."
START_TIME=$(date +%s)
while true; do
  if docker exec "$CONTAINER" sh -c 'test -f console.in' 2>/dev/null; then
    echo "✅ Server ready"
    break
  fi
  
  ELAPSED=$(($(date +%s) - START_TIME))
  if [ $ELAPSED -gt $TIMEOUT ]; then
    echo "❌ Server startup timeout"
    docker compose logs "$CONTAINER"
    exit 1
  fi
  
  sleep 2
done

echo ""
echo "🧪 Running spike test against Minecraft $VERSION..."
export MC_HOST=127.0.0.1
export MC_PORT=$PORT
export MC_USERNAME="Boaty_${VERSION//./_}"

npm run build
SPIKE_CRUISE=0.30 npm run spike

TEST_RESULT=$?

echo ""
echo "🛑 Stopping server..."
docker compose down

if [ $TEST_RESULT -eq 0 ]; then
  echo "✅ Test passed for Minecraft $VERSION"
  exit 0
else
  echo "❌ Test failed for Minecraft $VERSION"
  exit 1
fi
