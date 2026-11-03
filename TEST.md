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

### Level 3: Integration Tests

**What**: End-to-end scenarios: placement, driving, dismount, corrections, edge cases
**Where**: `test/integration/`
**Time**: ~6min total (both versions)
**Server**: Docker containers, one shared sequential server per run
**Command**: `npm run test:integration`

Test files:
- `placement.test.ts` — boat placement on various water surfaces
- `drive.test.ts` — driving at different cruise speeds (0.30, 0.36, 0.40, 0.50 b/t)
- `lifecycle.test.ts` — full journey: place → board → drive → leave → recover
- `corrections.test.ts` — server correction handling
- `dismount.test.ts` — entity_action vs other dismount patterns
- `edge-cases.test.ts` — chunk boundaries, narrow channels, edge drives

Results: 35 tests, 1 skipped.

```bash
# Run main integration suite
npm run test:integration

# Watch mode
npm run test:integration -- --watch
```

### Level 3b: Pathfinding Integration Tests

**What**: Route planning with A* around obstacles, waypoint coalescing, graceful failure
**Where**: `test/integration/pathfinding.test.ts`
**Time**: ~45sec total (both versions)
**Server**: Docker containers, **dedicated fresh servers per CI job** (isolated from main suite)
**Command**: `npm run test:integration:pathfinding`

Test scenarios:
- `travelAuto()` on clear water (falls back to direct drive)
- `travelAuto()` navigating around an island (A* detour)
- `travelAuto()` failing gracefully with no route (full-width wall), recovering the boat
- Respecting `maxSearchDistance` parameter

Results: 4 tests pass.

Why separate CI job: Pathfinding drives place once, drive long A* routes while mounted (several minutes),
then recover — cumulative heavy load. Running on the same shared server as the main integration suite would
tip the fragile edge-of-channel drives in later test files into `blocked`. The dedicated job starts a fresh
server just for pathfinding, keeping both suites' results reliable.

```bash
# Run pathfinding integration tests
npm run test:integration:pathfinding
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

Runs on every push/PR (3 separate matrix jobs + aggregation):

1. **Unit tests** (fast, no server)
2. **Docker spike** (1.21.4 + 26.1 in parallel) — quick go/no-go test
3. **Integration tests** (1.21.4 + 26.1, fresh servers) — 35 tests, 1 skipped per version
4. **Pathfinding integration** (1.21.4 + 26.1, separate fresh servers) — 4 tests per version
5. **Test Status** — aggregates all above; fails if any job fails

The pathfinding matrix job is dedicated and isolated: it starts its own fresh servers, runs only
the pathfinding tests, and does not contend with the main integration suite's shared server. This
keeps both suites' results reliable despite the heavy load from long A* drives.

Artifacts:
- Test logs (test-results/integration.json, test-results/pathfinding.json)

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
├── unit/                           # No server required
│   ├── kinematics.test.ts          # Physics model
│   ├── water.test.ts               # Block detection
│   └── pathfinding.test.ts         # A* route planning (unit)
├── integration/                    # Docker servers
│   ├── setup.ts                    # Common test server lifecycle
│   ├── placement.test.ts           # Main suite
│   ├── drive.test.ts               # Main suite
│   ├── lifecycle.test.ts           # Main suite
│   ├── corrections.test.ts         # Main suite
│   ├── dismount.test.ts            # Main suite
│   ├── edge-cases.test.ts          # Main suite
│   └── pathfinding.test.ts         # Separate suite (dedicated CI job)

spike/
├── spike.ts                        # Go/no-go test (23 test runs)
└── server/
    ├── setup.sh                    # Download vanilla server
    └── start.sh                    # Start with console.in input

.github/
├── docker/
│   ├── minecraft-1.21.4/Dockerfile
│   ├── minecraft-26.1/Dockerfile
│   └── server.properties.template
├── scripts/
│   └── docker-test.sh              # Multi-version test runner
└── workflows/
    └── test.yml                    # GitHub Actions CI: unit + spike + integration + pathfinding

vitest.integration.config.ts        # Main integration suite (excludes pathfinding.test.ts)
vitest.pathfinding.config.ts        # Pathfinding suite only
docker-compose.yml                  # Multi-version orchestration
Makefile                            # Quick shortcuts
```

## Next Steps

1. **Build Docker images**: `make docker-build`
2. **Test 1.21.4**: `make test-docker-1.21.4`
3. **Test 26.1**: `make test-docker-26.1`
4. **Add integration tests**: Create `test/integration/setup.ts`
5. **Add Prismarine Viewer**: Create `test/utils/viewer.ts`
6. **Push to GitHub**: Auto-run tests on PR
