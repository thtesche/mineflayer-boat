#!/usr/bin/env bash
# Download vanilla Minecraft server JAR from Mojang launcher
# Usage: ./download-server-jar.sh <version> [output-file]

set -euo pipefail

VERSION="${1:-26.1}"
OUTPUT="${2:-server.jar}"

echo "📥 Downloading Minecraft $VERSION server..."

# Get version manifest
MANIFEST=$(curl -fsSL https://piston-meta.mojang.com/mc/game/version_manifest_v2.json)

# Find version URL
VERSION_URL=$(echo "$MANIFEST" | grep -o '"id":"'$VERSION'"' -A 100 | grep '"url"' | head -1 | grep -o 'https[^"]*')

if [ -z "$VERSION_URL" ]; then
  echo "❌ Version $VERSION not found in manifest"
  exit 1
fi

echo "📍 Version URL: $VERSION_URL"

# Get version details
VERSION_JSON=$(curl -fsSL "$VERSION_URL")

# Extract server JAR URL
JAR_URL=$(echo "$VERSION_JSON" | grep -o '"server"' -A 20 | grep -o 'https://[^"]*jar')

if [ -z "$JAR_URL" ]; then
  echo "❌ Could not find server JAR URL for version $VERSION"
  exit 1
fi

echo "📍 JAR URL: $JAR_URL"

# Download JAR
curl -fsSL "$JAR_URL" -o "$OUTPUT"

if [ -f "$OUTPUT" ]; then
  SIZE=$(du -h "$OUTPUT" | cut -f1)
  echo "✅ Downloaded $OUTPUT ($SIZE)"
else
  echo "❌ Download failed"
  exit 1
fi
