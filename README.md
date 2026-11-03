# mineflayer-boat

[![Test](https://github.com/thtesche/mineflayer-boat/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/thtesche/mineflayer-boat/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/mineflayer-boat.svg)](https://www.npmjs.com/package/mineflayer-boat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

Boat travel for [Mineflayer](https://github.com/PrismarineJS/mineflayer) bots: place a carried
boat, board it, drive it, land on the far shore and get the boat back.

> **Status: Stable with pathfinding.** Placement, boarding, driving (straight or via A* route planning),
> dismount and recovery work reliably on vanilla 1.21.4 and 26.1 servers. Full integration test suite 
> (35 tests + 4 pathfinding tests, 1 skipped) gates CI. Remaining: `estimate()` in ticks.

## Why a plugin is needed

A boat ridden by a player is simulated by **that player's client**, which reports the result to the
server with `vehicle_move` every tick. Mineflayer has no boat physics and switches its own physics
off while mounted, so out of the box a bot in a boat cannot move. This plugin runs a small
kinematic boat model at 20 Hz, sends `vehicle_move` (plus `steer_boat` paddles), resyncs on server
corrections and keeps `bot.entity.position` in step with the boat.

It also works around Mineflayer 4.39.0 on 1.21.2+:

- `bot.placeEntity` cannot place boats (each wood is its own entity since 1.21.2, and on 4.39.0 the
  `use_item` it sends disconnects the bot). The plugin uses `lookAt` + `activateItem` and finds the
  spawned `*_boat` entity itself.
- `bot.dismount()` sends *jump*, which the server ignores. A 1.21.4 server leaves a vehicle on
  **sneak**, and takes the sneak flag only from `entity_action` (`start_sneaking`); the
  `player_input` shift bit is stored but not applied. The plugin sends both.
- Mineflayer does not notice that dismount (its `set_passengers` handler only looks at lists that
  contain the bot); the plugin clears `bot.vehicle` and emits `dismount` itself.

## Install

```bash
npm install mineflayer-boat
```

`mineflayer` (^4.39.0) is a peer dependency. The package is ESM and ships `.d.ts` types.

## Usage

```ts
import mineflayer from 'mineflayer'
import { Vec3 } from 'vec3'
import { plugin as boat } from 'mineflayer-boat'

const bot = mineflayer.createBot({ host: 'localhost', username: 'Boaty', version: '1.21.4' })
bot.loadPlugin(boat)

bot.once('spawn', async () => {
  const entity = await bot.boat.place(new Vec3(2, 63, 0.5)) // a water-surface point within reach
  await bot.boat.board(entity)
  const result = await bot.boat.drive(new Vec3(60, 0, 0.5))  // x/z of the stop point
  console.log(result.status, result.averageSpeed, result.corrections)
  await bot.boat.leave({ faceToward: new Vec3(62, 63, 0.5) }) // vanilla puts the rider on that side
  await bot.boat.recover(entity)                              // break it and pick it up again
})
```

Options go in the bot options (`createBot({ ..., boat: { ... } })`) or through
`bot.loadPlugin(boatPlugin({ ... }))`:

| Option | Default | Meaning |
|---|---|---|
| `kinematics.cruiseSpeed` | `0.3` | cruising speed, blocks/tick (vanilla terminal speed on water ≈ 0.4) |
| `kinematics.acceleration` / `deceleration` | `0.04` | speed change per tick |
| `kinematics.maxTurnRate` | `6` | degrees per tick |
| `kinematics.arriveDistance` | `0.05` | how close the target must be to count as reached (blocks) |
| `maxConsecutiveCorrections` | `3` | server corrections in a row that end a drive with `rejected` |

### API

- `bot.boat.findItem()` – best boat item in the inventory (plain before chest boats).
- `bot.boat.place(water, { signal?, item? })` → boat entity.
- `bot.boat.board(boat, { signal? })` – mounts and waits for the server.
- `bot.boat.drive(target, { signal?, onTick?, onCorrection?, maxTicks?, arriveDistance? })` → `DriveResult`
  (`status`: `arrived | blocked | rejected | aborted | lost | timeout`, `ticks`, `distance`,
  `averageSpeed`, `topSpeed`, `corrections`, `elapsedMs`, `position`). Drives a straight line;
  every step is checked so the boat's 1.375-wide box stays over water with room above. `arriveDistance`
  (default: tuned kinematics value) sets how close the target must be to count as reached; useful for
  guidance waypoints where orbiting is better than overshooting (a boat's minimum turning radius is ~1 block).
- `bot.boat.travel(from, to, { signal?, faceToward? })` → `{ status, recovered, boat?, distance?, ticks? }`
  One call that places, boards, drives, leaves and recovers the boat in one sequence. Returns `success`
  only if all steps succeed; otherwise returns the step that failed (`place_failed`, `board_failed`,
  `failed_to_drive`, etc.) and still recovers the boat.
- `bot.boat.travelAuto(from, to, { signal?, faceToward?, maxSearchDistance? })` → `{ status, recovered, boat?, driveResult? }`
  Like `travel()` but runs A* pathfinding to route around obstacles. Computes waypoints, drives them
  with a loose guidance tolerance (boats can't spiral onto turning points) and the goal with a tighter
  one. Returns the same status values as `travel()`.
- `bot.boat.leave({ signal?, faceToward? })` – dismounts by sneaking.
- `bot.boat.recover(boat, { signal?, itemName?, walkTo? })` → `true` when the item is back. The
  item usually sinks out of reach of the shore; without `walkTo` the bot swims to it in a straight
  line and returns to where it stood.

Planned seams to the host: `estimate(from, to)` time in ticks for a route.

## Development

### Quick Start

```bash
npm install
npm run build              # compile to dist/
```

**Test locally (no server):**
```bash
npm test                   # unit tests only
```

**Test with Docker (both 1.21.4 + 26.1):**
```bash
docker compose up -d                    # start Minecraft servers
npm run test                            # unit tests only
npm run test:integration                # main integration suite (35 tests)
npm run test:integration:pathfinding    # route planning tests (4 tests, requires fresh server)
docker compose down                     # stop servers
```

For the full suite (unit + integration + pathfinding):
```bash
npm run test:all
```

Or with Make:
```bash
make docker-build          # one-time setup
make docker-up && make test-all && make docker-down
# or simply: make test-docker
```

### Unit Tests

Fast, offline (no server):

```bash
npm test
```

Tests kinematics model and water detection.

### Integration Tests

Full end-to-end tests on live servers. **Requires a running Minecraft server:**

```bash
# Option A: Docker (recommended)
docker compose up -d minecraft-1.21.4
npm run test:integration
docker compose down

# Option B: Local server (needs Java 21)
npm run server:setup
bash spike/server/start.sh &            # in background
npm run test:integration
```

Tests placement, boarding, driving at various speeds, dismount mechanics, server correction
handling, edge cases, and route planning. See [`test/integration/README.md`](test/integration/README.md) for
details on each test and how to visualize bot movement.

The integration suite is split into two test runs with fresh servers to manage load:

- **Main integration** (35 tests, 1 skipped): lifecycle, placement, driving, corrections, dismount, edge cases.
  Runs against a shared sequential server.
- **Pathfinding integration** (4 tests): A* route planning around obstacles, island/impossible arenas, arc
  coalescing. Runs in its own dedicated CI job to isolate long drives from the main suite's tight 
  edge-of-channel drives.

Each test gets a fresh arena (world is reset via console commands), and test files run serially to avoid
interference.


### Local Testing

Start vanilla 1.21.4 server:
```bash
npm run server:setup            # one-time: download server jar (needs Java 21)
bash spike/server/start.sh      # keep running in background, port 25599
```

Run spike test:
```bash
npm run spike                   # place/board/drive/leave/recover cycle
SPIKE_CRUISE=0.40 npm run spike # try different speed
SPIKE_DEBUG=1 npm run spike     # log all packets
```

### Docker Multi-Version Testing

Test against 1.21.4 **and** 26.1 simultaneously:

```bash
docker compose up -d                                    # start servers
MC_HOST=127.0.0.1 MC_PORT=25599 npm run test:integration    # test 1.21.4
MC_HOST=127.0.0.1 MC_PORT=25600 npm run test:integration    # test 26.1
docker compose down                                    # stop servers
```

See [DOCKER.md](DOCKER.md) for setup, troubleshooting, and manual server management.

### Visualizing Bot Movement

Collect position history from a test run and visualize it interactively:

```bash
npx tsx spike/visualize.ts > /tmp/viz.json
# Open test-results/boat-visualization.html in a browser
```

The visualization shows:
- 2D overhead map of the test arena (water channel, shores)
- Animated bot trail during the drive
- Play/pause controls and speed adjustment
- Real-time metrics (status, distance, speed, corrections)

## Spike results

Vanilla 1.21.4 dedicated server, offline mode, still water 3 deep, 5-wide channel, straight run of
57.2 blocks (2026-10-23):

| Cruise | Ticks | Avg speed | Corrections | Runs |
|---|---|---|---|---|
| 0.30 | 197 | 0.290 b/t | 0 | 13 drives, all arrived; full GO 6/6 after the recovery fix |
| 0.36 | 166 | 0.345 b/t | 0 | 1 drive, arrived |
| 0.40 | 151 | 0.379 b/t | 0 | 1 drive, arrived |
| 0.50 | 124 | 0.461 b/t | 0 | 1 drive, arrived |

Before the recovery fix, 4 of 10 runs lost the boat item: it spawns at the boat with a random
kick and sinks out of reach of the shore during its 10-tick pickup delay. `recover()` now swims to
it.

No `moved wrongly` / `moved too quickly` warnings and no kicks in any run; the server dismount
teleport put the bot on the far shore every time. Since the server stops simulating a boat that a
player controls, the boat's height is held at the value the server settled it at before boarding.

## Acknowledgements

The approach (client-side boat tick with `vehicle_move`, sneak to dismount, break and pick up)
follows earlier in-bot implementations, in particular
[mrubens/jevcraft](https://github.com/mrubens/jevcraft) `src/boats.js` (MIT). No code was copied.

## License

[MIT](LICENSE) – Copyright (c) 2024 Thomas Tesche
