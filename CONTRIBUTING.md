# Contributing to mineflayer-boat

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

### Prerequisites
- Node.js 18+
- Java 21 (for local Spike server) or Docker (for multi-version testing)
- Git

### Initial Setup
```bash
git clone https://github.com/thtesche/mineflayer-boat.git
cd mineflayer-boat
npm install
npm run build
```

## Testing

We have three levels of tests:

### 1. Unit Tests (fast, no server)
```bash
npm test              # Run once
npm test -- --watch  # Watch mode
```

Tests boat physics, water detection, and kinematics calculations. Always passes locally.

### 2. Local Spike (manual server)
```bash
npm run server:setup        # One-time download
bash spike/server/start.sh  # Terminal 1: keep running

npm run spike               # Terminal 2: run test
```

Go/no-go test: place → board → drive → leave → recover. Takes ~3 minutes per run.

### 3. Integration Tests (automated, both 1.21.4 + 26.1)
```bash
make docker-build
docker compose up -d
npm run test:integration         # Main suite: placement, driving, dismount, etc.
npm run test:integration:pathfinding  # Pathfinding suite: A* around obstacles
docker compose down
```

Main integration suite (~6 min): 35 tests on a shared sequential server.
Pathfinding suite (~45 sec): 4 tests on a dedicated fresh server (isolated from main).

Combined: ~10 minutes total for full CI coverage.

## Workflow

1. **Create a branch** for your feature/fix:
   ```bash
   git checkout -b fix/dismount-timing
   ```

2. **Write tests first** (TDD):
   - Unit test in `test/unit/` (kinematics, water detection, pathfinding)
   - Integration test in `test/integration/` if it needs a live server (placement, driving, recovery)
   - Pathfinding integration test in `test/integration/pathfinding.test.ts` only if adding route planning logic

3. **Implement the feature**:
   - Update `src/` files
   - Keep commits atomic and small

4. **Run tests locally**:
   ```bash
   npm run test                       # Unit tests
   npm run build                      # Type check + compile
   npm run spike                      # Local server test (if relevant)
   docker compose up -d               # Start servers
   npm run test:integration           # Main integration suite (35 tests)
   npm run test:integration:pathfinding  # Pathfinding suite (4 tests, fresh server)
   docker compose down                # Stop servers
   ```

5. **Commit with clear message**:
   ```bash
   git commit -m "fix: handle boat corrections at high speeds"
   ```

6. **Push and open PR**:
   ```bash
   git push origin fix/dismount-timing
   ```

   - Add description of what changed and why
   - Link any relevant issues
   - GitHub Actions will automatically run all tests (unit + spike + integration + pathfinding)

## Code Style

- **TypeScript**: Strict mode, no `any` unless absolutely necessary
- **Naming**: Descriptive, PascalCase for classes/interfaces, camelCase for functions
- **Comments**: Only for *why*, not what (code should be self-documenting)
- **No semi-colons** (configured in tsconfig.json)

Example:
```ts
// ✅ Good
export async function boardBoat(bot: Bot, boat: Entity): Promise<void> {
  await bot.vehicle.mount(boat.id)
}

// ❌ Bad
export async function boardBoat(bot: any, boat: any): Promise<any> {
  // Mount the boat
  await bot.vehicle.mount(boat.id);
}
```

## Git Commit Guidelines

- **Scope**: `fix()`, `feat()`, `test()`, `docs()`, `refactor()`, `chore()`
- **Tense**: Present tense ("add feature" not "added feature")
- **Length**: First line ≤ 50 chars, detailed explanation below if needed

Examples:
```
feat: add speed limiting for correction robustness
fix: prevent boat dismount desync on high latency
test: add integration tests for server corrections
docs: clarify vehicle_move packet handling
```

## Testing Your Changes

### Before opening PR, verify:
```bash
npm run typecheck                      # TypeScript strict mode
npm run build                          # Compiles to dist/
npm test                               # All unit tests pass
docker compose up -d
npm run test:integration               # Main integration suite (35 tests)
npm run test:integration:pathfinding   # Pathfinding suite (4 tests)
docker compose down
```

### For new features:
- Add unit test in `test/unit/`
- Add integration test in `test/integration/` if server interaction
- Update README or docs if user-facing

### For bug fixes:
- Add regression test that catches the bug
- Verify fix passes that test
- No new unit tests needed if just fixing existing functionality

## PR Review Checklist

**For reviewers:**
- Tests pass on both versions (1.21.4 + 26.1)
- Code style consistent
- No regressions in related functionality
- Documentation updated if user-facing

**For authors:**
- [ ] All tests pass locally (unit + integration + pathfinding)
- [ ] GitHub Actions passes (unit + spike + integration + pathfinding jobs)
- [ ] No console errors/warnings
- [ ] Documentation updated (README.md, TEST.md, CONTRIBUTING.md if relevant)
- [ ] Commits are atomic and well-described

## Project Structure

```
src/
  index.ts              # Plugin export
  boat.ts               # Main API (place, board, drive, travel, travelAuto, leave, recover)
  pathfinding.ts        # A* route planning
  kinematics.ts         # Physics model
  water.ts              # Water/obstacle detection
  augment.ts            # TypeScript augmentation

test/
  unit/                 # No server required
    kinematics.test.ts
    water.test.ts
    pathfinding.test.ts
  integration/          # Docker servers required
    setup.ts
    placement.test.ts
    drive.test.ts
    lifecycle.test.ts
    corrections.test.ts
    dismount.test.ts
    edge-cases.test.ts
    pathfinding.test.ts  # Route planning (separate CI job with fresh server)

spike/
  spike.ts              # Go/no-go test script
  server/
    setup.sh, start.sh  # Test server management

.github/
  workflows/test.yml    # GitHub Actions CI: unit + spike + integration + pathfinding
  docker/               # Multi-version Dockerfiles
  scripts/              # Test utilities

vitest.integration.config.ts    # Main integration suite
vitest.pathfinding.config.ts    # Pathfinding integration suite
```

## Common Tasks

### Add a new physics feature
1. Implement in `src/kinematics.ts`
2. Add unit test in `test/unit/kinematics.test.ts`
3. Run spike test to verify server behavior
4. Update README "Usage" or API docs

### Fix a server interaction bug
1. Add regression test in `test/integration/lifecycle.test.ts` or appropriate file
2. Implement fix in `src/boat.ts`
3. Verify unit tests + main integration suite pass
4. Document any version-specific behavior in README or TEST.md

### Add a pathfinding feature or fix
1. Add unit test in `test/unit/pathfinding.test.ts` (offline)
2. Implement in `src/pathfinding.ts`
3. Add integration test in `test/integration/pathfinding.test.ts` if server-dependent
4. Run `npm run test:integration:pathfinding` against a fresh server (takes ~45sec)
5. Verify unit and integration tests pass

### Optimize boat speed/physics
1. Run spike with different `SPIKE_CRUISE` values
2. Benchmark against vanilla boat behavior
3. Update physics constants in `src/kinematics.ts`
4. Add speed-specific test case in `test/integration/drive.test.ts`
5. Verify main integration suite still passes (35 tests)

## Questions?

- **Spike test**: See [TEST.md](TEST.md) and [DOCKER.md](DOCKER.md)
- **Physics questions**: Check comments in `src/kinematics.ts`
- **Minecraft protocol**: See [PrismarineJS protocol docs](https://github.com/PrismarineJS/minecraft-protocol)
- **Mineflayer issues**: Ask in [Mineflayer issues](https://github.com/PrismarineJS/mineflayer/issues)

## License

All contributions are licensed under MIT (see LICENSE file).
