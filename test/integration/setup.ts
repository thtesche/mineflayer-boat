/**
 * Common test setup for integration tests: server lifecycle, bot creation, arena building.
 * Each test file imports from here instead of duplicating server setup logic.
 */

import { appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import type { Bot } from 'mineflayer'
import mineflayer from 'mineflayer'
import { Vec3 } from 'vec3'
import { boatPlugin } from '../../src/index.js'

/**
 * Plain time-based delay. Use this (not `bot.waitForTicks`) whenever the bot is
 * mounted: mineflayer sets `shouldUsePhysics = false` on mount and stops
 * emitting `physicsTick`, so `waitForTicks` would hang until its own timeout.
 */
export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

export interface TestConfig {
  host: string
  port: number
  username: string
  version: string
  boatOptions?: any
}

export interface TestArena {
  start: Vec3
  launch: Vec3
  finish: Vec3
  farShore: Vec3
  laneZ: number
}

/**
 * Default test configuration (Docker 1.21.4 on localhost:25599)
 */
export const defaultConfig: TestConfig = {
  host: process.env.MC_HOST ?? '127.0.0.1',
  port: Number(process.env.MC_PORT ?? 25599),
  username: process.env.MC_USERNAME ?? 'Boaty',
  version: process.env.MC_VERSION ?? '1.21.4',
  boatOptions: { kinematics: { cruiseSpeed: 0.30 } },
}

/**
 * Standard arena for spike tests: 57-block straight water channel
 */
export const defaultArena: TestArena = {
  laneZ: 0.5,
  start: new Vec3(-0.5, -60, 0.5),
  launch: new Vec3(1.8, -60.1, 0.5),
  finish: new Vec3(59.0, 0, 0.5),
  farShore: new Vec3(61, -60, 0.5),
}

/**
 * Write a command to the server console (Docker container or local).
 * When MC_DOCKER names a running container, pipe the command into its
 * /server/console.in via `docker exec`; otherwise append to the local file.
 */
export function sendConsoleCommand(file: string, cmd: string): void {
  sendConsoleCommands(file, [cmd])
}

/**
 * Send several console commands in a single write. Batching matters under
 * Docker: each `docker exec` is a synchronous process spawn that blocks the
 * event loop, so one exec for a dozen commands (instead of a dozen execs)
 * keeps the bot from falling behind on packets and flaking confirm timeouts.
 */
export function sendConsoleCommands(file: string, cmds: string[]): void {
  if (cmds.length === 0) return
  const payload = cmds.join('\n') + '\n'
  const container = process.env.MC_DOCKER
  if (container != null && container !== '') {
    // Bound the exec: if the docker daemon wedges, fail fast instead of
    // hanging the whole suite (execFileSync has no implicit timeout).
    execFileSync('docker', ['exec', '-i', container, 'sh', '-c', 'cat >> /server/console.in'], {
      input: payload,
      timeout: 15000,
    })
  } else {
    appendFileSync(file, payload)
  }
}

/**
 * Build the standard arena on the server.
 * Superflat: bedrock -64, dirt -63..-62, grass -61, ground y=-60
 * Water channel: x 0..59, z -2..2, y -63..-61
 */
export async function buildArena(
  bot: Bot,
  config: TestConfig,
  arena: TestArena,
  consoleFile: string = `/tmp/console-${config.port}.in`,
): Promise<void> {
  // Only the water band (y -63..-61) is ever reshaped by tests (dirt walls,
  // extended water), so the grass/water fills reset everything a test can
  // change. The old `fill ... air` over y -60..-50 touched ~10k blocks every
  // reset for nothing (superflat is already air above -61) and lagged the
  // server enough to flake the confirm timeouts late in a run; it is gone.
  const cmds = [
    'gamerule doDaylightCycle false',
    'gamerule doMobSpawning false',
    'gamerule doWeatherCycle false',
    'time set day',
    'weather clear',
    'difficulty peaceful',
    'kill @e[type=!minecraft:player]',
    'fill -6 -63 -6 66 -61 6 grass_block',
    'fill 0 -63 -2 59 -61 2 water',
    `clear ${config.username}`,
    `gamemode survival ${config.username}`,
    `give ${config.username} oak_boat 1`,
    `tp ${config.username} ${arena.start.x} ${arena.start.y} ${arena.start.z} -90 30`,
  ]

  sendConsoleCommands(consoleFile, cmds)

  // Wait for arena to be ready
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    const water = bot.blockAt(new Vec3(30, -61, 0))
    if (
      bot.entity.position.distanceTo(arena.start) < 0.6 &&
      water?.name === 'water' &&
      bot.inventory.items().some((item: any) => item.name.includes('boat'))
    ) {
      return
    }
    await sleep(100)
  }

  throw new Error(
    `arena not ready: pos=${bot.entity.position}, ` +
      `water=${bot.blockAt(new Vec3(30, -61, 0))?.name}, ` +
      `boat=${bot.inventory.items().find((item: any) => item.name.includes('boat'))?.name}`,
  )
}

/**
 * Create a test bot with the plugin loaded.
 */
export function createTestBot(config: TestConfig): Bot {
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    auth: 'offline',
  })

  bot.loadPlugin(boatPlugin(config.boatOptions))

  return bot
}

/**
 * Connect a bot, load the boat plugin, and wait for it to spawn.
 */
export async function connectBot(config: TestConfig): Promise<Bot> {
  const bot = createTestBot(config)

  await new Promise<void>((resolve, reject) => {
    bot.on('spawn', () => resolve())
    bot.on('error', reject)
    bot.on('kicked', (reason: any) => reject(new Error(`kicked: ${JSON.stringify(reason)}`)))
    setTimeout(() => reject(new Error('bot spawn timeout')), 30000)
  })

  return bot
}

/**
 * Reset the world and the bot to a clean arena. Call from `beforeEach` so each
 * test starts from the same state: all files share one world, and a previous
 * test may have left the bot mid-drive, mounted, or on the far shore.
 */
export async function resetArena(bot: Bot, config: TestConfig, arena: TestArena): Promise<void> {
  // Drop any client-side vehicle state left over from a previous test; the
  // server already removed the boat via `kill @e`, but mineflayer can miss the
  // dismount on 1.21.x (see leave() in src/boat.ts).
  const anyBot = bot as any
  if (anyBot.vehicle != null) {
    anyBot.vehicle = null
    if (anyBot.entity != null) anyBot.entity.vehicle = null
  }
  bot.clearControlStates()
  await buildArena(bot, config, arena)
  // Let the reset fully drain before the test places a boat. buildArena's poll
  // can pass while the server is still applying the kill/fill/tp from this (or a
  // back-to-back previous) reset; placing a boat into that churn desyncs it and
  // the next drive is immediately "lost". A short settle makes resets that land
  // close together — e.g. a near-instant test followed by the next beforeEach —
  // safe.
  await sleep(500)
}


