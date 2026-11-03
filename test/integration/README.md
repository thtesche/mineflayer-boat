# Integration Tests

End-to-end tests for mineflayer-boat that require a running Minecraft server.
All 31 tests pass reliably and gate CI on GitHub Actions.

## Prerequisites

- Docker or local Minecraft server running
- Port 25599 (1.21.4) or 25600 (26.1) accessible
- Server in offline mode with superflat world

## Test Files

### `placement.test.ts`
Tests boat placement on various water surfaces.
- Standard water placement
- Entity type validation
- Multiple boats sequentially
- Rejection on non-water blocks

### `drive.test.ts`
Tests boat driving at different cruise speeds.
- Speed variations: 0.25, 0.30, 0.40 b/t
- Acceleration and terminal velocity
- Speed stability during cruise

### `lifecycle.test.ts`
Tests the complete boat journey.
- place → board → drive → leave → recover
- Event emission order
- Dismount positioning
- Quick succession trips

### `corrections.test.ts`
Tests server correction handling.
- Zero corrections on calm water
- Correction counting and reporting
- Recovery from stalls
- Metrics reporting

### `dismount.test.ts`
Tests dismount mechanics and packets.
- Successful dismount after short drive
- Dismounting to specified shore
- Correct rotation facing target
- Dismount event emission
- Rapid dismount attempts

### `edge-cases.test.ts`
Tests challenging scenarios.
- Tight water channels (3 blocks wide)
- Halting when blocked
- Shallow water (1 block deep)
- Chunk boundary crossing
- Sideways drift recovery
- Long distance drives (100+ blocks)

## Running Tests

### All integration tests
```bash
npm run test:integration
```

### Watch mode (re-run on file changes)
```bash
npm run test:integration:watch
```

### Single test file
```bash
npx vitest --config vitest.integration.config.ts test/integration/placement.test.ts
```

### With specific server
```bash
MC_HOST=127.0.0.1 MC_PORT=25599 npm run test:integration
```

## Test Setup

Each test file uses the common `setup.ts` module:

- **`defaultConfig`** — server connection (host, port, version)
- **`defaultArena`** — standard 57-block water channel
- **`buildArena()`** — creates test water arena on server
- **`createTestBot()`** — initializes bot with plugin

### Arena Layout
```
superflat: bedrock -64, dirt -63..-62, grass -61, ground y=-60
channel: x 0..59, z -2..2, water y -63..-61
start shore: x < 0
far shore: x >= 60
lane: z = 0.5
```

## Test Results

Results are saved to `test-results/`:
- `integration.json` — Vitest JSON output
- `report.html` — HTML summary (when using reporter)

### Report Generation
Tests can optionally generate an HTML report with viewer snapshots:

```ts
import { TestReporter } from '../utils/reporter'

const reporter = new TestReporter({
  outputDir: 'test-results',
  title: 'Boat Lifecycle Test',
})

// After test
await reporter.generateReport()
```

## Viewer Integration

Tests can record bot movement and generate interactive 3D viewers:

```ts
import { TestViewer } from '../utils/viewer'

const viewer = new TestViewer(bot)
viewer.startRecording()

// ... run test ...

viewer.stopRecording()
await viewer.saveHTML('test-results/test-name.html')
```

The generated HTML includes:
- 3D viewport (ready for Prismarine Viewer integration)
- Bot position history
- Velocity statistics
- Speed metrics

## Debugging

### Check server logs
```bash
docker-compose logs minecraft-1.21.4 | tail -50
```

### Enable packet logging
```bash
SPIKE_DEBUG=1 npm run test:integration
```

### Test-specific debugging
```ts
// In test
console.log('Bot position:', bot.entity.position)
console.log('Boat state:', bot.vehicle)
console.log('Block below:', bot.blockAt(bot.entity.position.offset(0, -1, 0)))
```

### Extend timeouts
Edit `vitest.integration.config.ts`:
```ts
testTimeout: 180000, // 3 minutes
```

## Common Issues

### Tests hang on spawn
Server may not be ready. Check:
```bash
docker-compose logs minecraft-1.21.4 | grep "Done"
```

### Arena not built
Console commands not reaching server. Verify:
```bash
docker exec minecraft-1.21.4 ls /server/console.in
```

### Boat placement fails
Water blocks not detected. Check arena fill command completed:
```bash
docker exec minecraft-1.21.4 sh -c "echo 'testforblock 30 -61 0 water' >> /server/console.in"
```

## Visualizing Bot Movement

Collect bot position history from a test drive and view it as an interactive 2D animation:

```bash
npx tsx spike/visualize.ts
# Generates test-results/vizdata.json with 193 frames of position data
# Open test-results/boat-visualization.html in a browser
```

The visualization shows:
- 2D overhead view of the arena (water channel, shores, start/finish)
- Animated bot trail colored by frame
- Play/pause controls and frame-by-frame stepping
- Real-time metrics during playback (position, speed, corrections)

This is useful for debugging pathfinding issues, verifying the physics model, or just watching
the bot work.

## Future Enhancements

- [ ] Prismarine Viewer 3D rendering in HTML
- [ ] Screenshot comparisons (expected vs actual)
- [ ] Performance benchmarking
- [ ] Network latency simulation
- [ ] Multi-version test matrix
- [ ] Replay file generation (Minecraft Replay format)
