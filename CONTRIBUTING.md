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

### 3. Docker Multi-Version (automated, both 1.21.4 + 26.1)
```bash
make docker-build
make test-docker
```

Automatically starts servers, runs spike, validates both versions. Takes ~5 minutes total.

## Workflow

1. **Create a branch** for your feature/fix:
   ```bash
   git checkout -b fix/dismount-timing
   ```

2. **Write tests first** (TDD):
   - Unit test in `test/unit/`
   - Integration test in `test/integration/` if needed

3. **Implement the feature**:
   - Update `src/` files
   - Keep commits atomic and small

4. **Run tests locally**:
   ```bash
   npm run test          # Unit tests
   npm run build         # Type check + compile
   npm run spike         # Local server test (if relevant)
   make test-docker      # Or Docker tests
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
   - GitHub Actions will automatically run all tests

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
npm run typecheck          # TypeScript strict mode
npm run build              # Compiles to dist/
npm test                   # All unit tests pass
make test-docker           # Both versions pass
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
- [ ] All tests pass locally
- [ ] GitHub Actions passes (all 3 workflows)
- [ ] No console errors/warnings
- [ ] Documentation updated (README, DOCKER.md, TEST.md if relevant)
- [ ] Commits are atomic and well-described

## Project Structure

```
src/
  index.ts          # Plugin export
  boat.ts           # Main API (place, board, drive, leave, recover)
  kinematics.ts     # Physics model
  water.ts          # Water detection
  augment.ts        # TypeScript augmentation

test/
  unit/             # No server required
    kinematics.test.ts
    water.test.ts
  integration/      # Docker servers required
    (planned)
  utils/
    viewer.ts       # Prismarine Viewer integration

spike/
  spike.ts          # Go/no-go test script
  server/
    setup.sh, start.sh  # Test server management

.github/
  workflows/test.yml    # GitHub Actions CI
  docker/               # Multi-version Dockerfiles
  scripts/              # Test utilities
```

## Common Tasks

### Add a new physics feature
1. Implement in `src/kinematics.ts`
2. Add unit test in `test/unit/kinematics.test.ts`
3. Run spike test to verify server behavior
4. Update README "Usage" or API docs

### Fix a server interaction bug
1. Add regression test in `test/integration/`
2. Implement fix in `src/boat.ts` or `src/entities.ts`
3. Run `make test-docker` to verify both versions
4. Document any version-specific behavior

### Optimize boat speed/physics
1. Run spike with different `SPIKE_CRUISE` values
2. Benchmark against vanilla boat behavior
3. Update physics constants in `kinematics.ts`
4. Add speed-specific test case in `test/integration/drive.test.ts`

## Questions?

- **Spike test**: See [TEST.md](TEST.md) and [DOCKER.md](DOCKER.md)
- **Physics questions**: Check comments in `src/kinematics.ts`
- **Minecraft protocol**: See [PrismarineJS protocol docs](https://github.com/PrismarineJS/minecraft-protocol)
- **Mineflayer issues**: Ask in [Mineflayer issues](https://github.com/PrismarineJS/mineflayer/issues)

## License

All contributions are licensed under MIT (see LICENSE file).
