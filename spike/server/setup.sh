#!/usr/bin/env bash
# Downloads a vanilla 1.21.4 server into spike/server/run and writes a
# throwaway test configuration: offline mode, superflat, peaceful, port 25599.
# Never point this at a real world.
set -euo pipefail
cd "$(dirname "$0")"
VERSION="${MC_VERSION:-1.21.4}"
PORT="${MC_PORT:-25599}"
mkdir -p run
cd run
if [ ! -f server.jar ]; then
  manifest=$(curl -sfL https://piston-meta.mojang.com/mc/game/version_manifest_v2.json)
  version_url=$(node -e "const m=JSON.parse(process.argv[1]);console.log(m.versions.find(v=>v.id===process.argv[2]).url)" "$manifest" "$VERSION")
  version_json=$(curl -sfL "$version_url")
  read -r jar_url jar_sha1 < <(node -e "const v=JSON.parse(process.argv[1]).downloads.server;console.log(v.url,v.sha1)" "$version_json")
  curl -sfL "$jar_url" -o server.jar.part
  echo "$jar_sha1  server.jar.part" | shasum -a 1 -c -
  mv server.jar.part server.jar
fi
echo "eula=true" > eula.txt
cat > server.properties <<PROPS
server-port=$PORT
online-mode=false
level-type=minecraft\:flat
level-name=boat-test
gamemode=survival
difficulty=peaceful
spawn-protection=0
spawn-monsters=false
spawn-animals=false
generate-structures=false
view-distance=6
simulation-distance=6
motd=mineflayer-boat throwaway test server
enable-command-block=false
max-players=4
PROPS
echo "server ready in $(pwd) (port $PORT)"
