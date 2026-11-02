# Testing mineflayer-boat

Comprehensive test guide for the three test levels: unit tests, Docker multi-version tests, and integration tests with visual validation.

## Quick Start

```bash
# Unit tests only (fast, no server)
make test

# Local spike against vanilla server
make spike-setup && make spike-server &  # Terminal 1
make spike                               # Terminal 2

# Docker multi-version (both 1.21.4 + 26.1)
make docker-build
make test-docker

# Full test suite
make test-all
```

## Test Levels

### Level 1: Unit Tests (vitest)

**What**: Kinematics, water detection, physics calculations
**Where**: `test/unit/`
**Time**: ~80ms
**Server**: None required
**Command**: `npm test` or `make test`

```bash
# Run unit tests
npm test

# Watch mode for development
npm test -- --watch
```

Tests for:
- Boat physics model (acceleration, turning, terminal velocity)
- Water block detection
- Velocity calculations

### Level 2: Docker Multi-Version (Spike + Validation)

**What**: End-to-end spike (place → board → drive → leave → recover) across versions
**Where**: `spike/spike.ts` with version matrix
**Time**: ~2min per version (4min total)
**Server**: Docker containers (both versions parallel-capable)
**Command**: `npm run test:docker:all` or `make test-docker`

Supported versions:
- **1.21.4** (Java 21) — port 25599
- **26.1** (Java 25) — port 25600

Individual version:
```bash
npm run test:docker:1.21.4
npm run test:docker:26.1
```

Test flow:
1. Docker image builds (vanilla server JAR)
2. Server starts, waits for readiness
3. Spike: places boat, boards, drives 57 blocks straight, lands, recovers
4. Server stops
5. Test passes if bot returns home and boat recovered

### Level 3: Integration Tests (Planned)

**What**: Detailed scenarios with Prismarine Viewer output
**Where**: `test/integration/`
**Time**: ~1-2min per scenario
**Server**: Docker containers
**Output**: HTML with 3D viewer

Planned test scenarios:
- `placement.test.ts` — boat placement on various water surfaces
- `drive.test.ts` — driving at different cruise speeds (0.30, 0.36, 0.40, 0.50 b/t)
- `lifecycle.test.ts` — full journey: place → board → drive → leave → recover
- `corrections.test.ts` — server correction handling
- `dismount.test.ts` — entity_action vs other dismount patterns
- `edge-cases.test.ts` — chunk boundaries, narrow channels, etc.

Each test generates:
- Console logs with timing
- Prismarine Viewer snapshot (3D world + bot path)
- Comparison screenshot (expected vs actual)

```bash
# Run integration tests
npm run test:integration

# Watch mode
npm run test:integration -- --watch
```

## Local Development

### Setup Spike Server (One-time)

```bash
# Download vanilla 1.21.4 server
npm run server:setup
# → creates spike/server/run/server.jar + config

# Start server (blocking, run in separate terminal)
bash spike/server/start.sh
# → listens on port 25599
# → creates spike/server/run/console.in for commands
```

### Run Spike Test

```bash
# Against local server (requires it running)
npm run spike

# With different cruise speed
SPIKE_CRUISE=0.40 npm run spike

# With packet logging (debug)
SPIKE_DEBUG=1 npm run spike
```

Expected output:
```
start on shore at (x, y, z) holding oak_boat
placed oak_boat #123 at (x, y, z)
boat settled at (x, y, z)
boarded; bot.vehicle = oak_boat
drove 57.2 blocks in 197 ticks, avg 0.290 b/t, 0 corrections → arrived
left boat; dismounted to (x, y, z)
recovered oak_boat, all 13 runs succeeded ✓
```

## Docker Development

### Build Images

```bash
# Build both versions
make docker-build

# Or manually
docker-compose build minecraft-1.21.4
docker-compose build minecraft-26.1
```

### Start/Stop Servers

```bash
# Start both (background)
make docker-up
# → 1.21.4 on localhost:25599
# → 26.1 on localhost:25600

# Check logs
docker-compose logs minecraft-1.21.4
docker-compose logs minecraft-26.1

# Stop both
make docker-down
```

### Manual Docker Test

```bash
# Start one server
docker-compose up -d minecraft-1.21.4

# Run spike against it
MC_HOST=127.0.0.1 MC_PORT=25599 npm run spike

# Stop
docker-compose down
```

## GitHub Actions CI

**Workflow**: `.github/workflows/test.yml`

Runs on every push/PR:
1. **Unit tests** (fast, always run)
2. **Docker multi-version** (1.21.4 + 26.1 in parallel)
3. **Spike validation** (both versions)

Artifacts:
- Test logs
- Prismarine Viewer HTML (integration tests only, when available)

## Troubleshooting

### "No server console at spike/server/run/console.in"
```bash
# Start the server first
bash spike/server/start.sh &
```

### Docker image build fails
```bash
# Check Java is available
docker --version
docker-compose --version

# Rebuild with verbose output
docker-compose build --no-cache
```

### Port already in use (25599/25600)
```bash
# Kill existing containers
docker-compose down

# Or use different ports
MC_PORT=25601 npm run spike
```

### Boat doesn't move (spike)
- Check server logs: `docker-compose logs minecraft-1.21.4`
- Verify water block at position: look for "block water" in logs
- Try lower cruise speed: `SPIKE_CRUISE=0.20 npm run spike`

## Architecture Overview

```
test/
├── unit/                      # No server required
│   ├── kinematics.test.ts     # Physics model
│   └── water.test.ts          # Block detection
├── integration/               # Docker servers
│   ├── setup.ts              # Common test server lifecycle
│   ├── placement.test.ts
│   ├── drive.test.ts
│   ├── lifecycle.test.ts
│   ├── corrections.test.ts
│   ├── dismount.test.ts
│   └── edge-cases.test.ts
└── utils/
    ├── testBot.ts            # Helper: bot setup, assertions
    ├── viewer.ts             # Prismarine Viewer integration
    └── assertions.ts         # Custom matchers

spike/
├── spike.ts                   # Go/no-go test (23 test runs)
└── server/
    ├── setup.sh              # Download vanilla server
    └── start.sh              # Start with console.in input

.github/
├── docker/
│   ├── minecraft-1.21.4/Dockerfile
│   ├── minecraft-26.1/Dockerfile
│   └── server.properties.template
├── scripts/
│   └── docker-test.sh        # Multi-version test runner
└── workflows/
    └── test.yml              # GitHub Actions CI

docker-compose.yml            # Multi-version orchestration
Makefile                       # Quick shortcuts
```

## Next Steps

1. **Build Docker images**: `make docker-build`
2. **Test 1.21.4**: `make test-docker-1.21.4`
3. **Test 26.1**: `make test-docker-26.1`
4. **Add integration tests**: Create `test/integration/setup.ts`
5. **Add Prismarine Viewer**: Create `test/utils/viewer.ts`
6. **Push to GitHub**: Auto-run tests on PR
