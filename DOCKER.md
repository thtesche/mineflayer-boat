# Docker Multi-Version Testing Setup

Phase 1: Complete Docker infrastructure for testing mineflayer-boat against Minecraft 1.21.4 and 26.1.

## What's Included

### Docker Images
- **minecraft-1.21.4** (Java 21, port 25599)
  - Vanilla server downloaded from official Mojang launcher
  - Fixed JAR hash for reproducibility
  
- **minecraft-26.1** (Java 25, port 25600)
  - Dynamic JAR download from Mojang manifest
  - Auto-detects latest 26.1 patch version

### Infrastructure Files
```
.github/
├── docker/
│   ├── minecraft-1.21.4/Dockerfile       (static 1.21.4 JAR)
│   ├── minecraft-26.1/Dockerfile         (dynamic JAR from manifest)
│   └── server.properties.template         (superflat, peaceful, offline)
└── scripts/
    ├── docker-test.sh                    (run spike against Docker)
    └── download-server-jar.sh            (dynamic JAR download)

docker-compose.yml                         (both versions, shared network)
Makefile                                   (quick shortcuts)
TEST.md                                    (full test documentation)
```

## Quick Start

### Build Docker Images
```bash
make docker-build

# Or manually:
docker-compose build
```

Expected output:
```
Building minecraft-1.21.4 ... done
Building minecraft-26.1 ... done
```

### Test Both Versions
```bash
make test-docker

# Or individually:
make test-docker-1.21.4
make test-docker-26.1
```

This will:
1. Start Minecraft server (Docker)
2. Wait for readiness
3. Run spike test (place → board → drive → leave → recover)
4. Stop server
5. Exit with test result

Expected output (success):
```
🚀 Starting Minecraft 1.21.4 in Docker...
✅ Server ready
🧪 Running spike test against Minecraft 1.21.4...
start on shore at (x, y, z) holding oak_boat
placed oak_boat #123 at (x, y, z)
boarded; bot.vehicle = oak_boat
drove 57.2 blocks in 197 ticks, avg 0.290 b/t, 0 corrections → arrived
left boat; dismounted to (x, y, z)
recovered oak_boat, all 13 runs succeeded ✓
✅ Test passed for Minecraft 1.21.4
```

### Manual Server Management
```bash
# Start both servers (background)
make docker-up

# View logs
docker-compose logs minecraft-1.21.4
docker-compose logs minecraft-26.1

# Stop
make docker-down
```

## Configuration

### Server Properties
All servers use `server.properties.template`:
- **offline-mode=true** (no login needed)
- **level-type=flat** (superflat for consistent testing)
- **difficulty=peaceful** (no mobs)
- **port=25599** (1.21.4) / **25600** (26.1)

Modify `server.properties.template` to change all servers, or edit Docker volumes.

### Test Parameters
Override via environment variables:
```bash
# Different port
MC_PORT=25600 npm run spike

# Different username
MC_USERNAME=TestBot npm run spike

# Debug packet logging
SPIKE_DEBUG=1 npm run spike

# Different cruise speed
SPIKE_CRUISE=0.40 npm run spike
```

### Java Memory
Edit `docker-compose.yml` environment `JAVA_TOOL_OPTIONS` to adjust:
```yaml
environment:
  - JAVA_TOOL_OPTIONS=-Xms512M -Xmx1G
```

## Architecture

### Docker Network
Both servers run in shared `test-network` (Docker bridge):
- **minecraft-1.21.4**: `minecraft-1.21.4:25599`
- **minecraft-26.1**: `minecraft-26.1:25600`
- Tests connect via `127.0.0.1:25599` and `127.0.0.1:25600`

### Console Input
Each container:
1. Creates `/server/console.in` (FIFO)
2. Tails it into Java stdin
3. Tests write commands via `docker exec` or volume mount

```bash
# Send a command to running server
echo "say Hello" | docker exec -i minecraft-1.21.4 tee /server/console.in
```

### Healthcheck
Each container has readiness check:
- Waits for server to be ready (max 30s)
- Not foolproof (Java startup != accept connections)
- Use test script delay if needed

## Troubleshooting

### "docker-compose: command not found"
```bash
# Check if docker-compose is installed
docker-compose --version

# If not installed:
# Option 1: Install as standalone
curl -fsSL https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Option 2: Use docker compose (v2, no hyphen)
docker compose version  # If this works, use: docker compose build

# Option 3: Install via package manager
# macOS: brew install docker-compose
# Ubuntu: apt-get install docker-compose
```

### Build fails: "Java not found"
```bash
docker --version  # >= 20.10
docker-compose --version  # >= 1.29 or use 'docker compose'
```

### Build fails: Network error downloading JAR
```bash
# Check internet connection
curl -I https://piston-meta.mojang.com/mc/game/version_manifest_v2.json

# Use --no-cache if cached layer is stale
docker-compose build --no-cache
```

### 26.1 JAR download fails
The 26.1 version lookup is dynamic:
```bash
# Manually test manifest lookup
curl -fsSL https://piston-meta.mojang.com/mc/game/version_manifest_v2.json | grep 26.1
```

If 26.1 doesn't exist yet, build will fail gracefully and print the latest available version.

### Port 25599/25600 already in use
```bash
# Find process using port
lsof -i :25599
lsof -i :25600

# Kill it
kill -9 <PID>

# Or use different port
MC_PORT=25601 npm run spike
```

### Server starts but test times out
```bash
# Check server logs
docker-compose logs minecraft-1.21.4 | tail -50

# Server might need more time
# Edit docker-test.sh: increase TIMEOUT variable

# Or check arena building failed
# Edit spike.ts: lower deadline timeout to 15000ms
```

### Bot can't connect to server
```bash
# Test manually
docker exec minecraft-1.21.4 sh -c 'curl -I localhost:25599' || echo "not ready"

# Check server actually started
docker-compose logs minecraft-1.21.4 | grep "Done"

# Verify network
docker network inspect test-network
```

## Next Steps

1. **Build**: `make docker-build`
2. **Test 1.21.4**: `make test-docker-1.21.4`
3. **Test 26.1**: `make test-docker-26.1`
4. **GitHub Actions**: `.github/workflows/test.yml` (Phase 2)
5. **Integration Tests**: `test/integration/` (Phase 3)

## Files Reference

| File | Purpose |
|------|---------|
| `.github/docker/minecraft-1.21.4/Dockerfile` | Static 1.21.4 build (fixed JAR) |
| `.github/docker/minecraft-26.1/Dockerfile` | Dynamic 26.1 build (manifest lookup) |
| `.github/docker/server.properties.template` | Shared server config |
| `.github/scripts/docker-test.sh` | Test runner (orchestrates docker-compose + spike) |
| `.github/scripts/download-server-jar.sh` | Utility for JAR download (used by 26.1 Dockerfile) |
| `docker-compose.yml` | Multi-version orchestration (both servers) |
| `Makefile` | Quick commands (make test-docker, etc.) |
| `TEST.md` | Full testing documentation |
| `DOCKER.md` | This file |
