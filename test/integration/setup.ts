/**
 * Common test setup for integration tests: server lifecycle, bot creation, arena building.
 * Each test file imports from here instead of duplicating server setup logic.
 */

import { appendFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { Bot } from 'mineflayer'
import mineflayer from 'mineflayer'
import { Vec3 } from 'vec3'
import { describe, beforeAll, afterAll, expect } from 'vitest'
import { boatPlugin } from '../../src/index.js'

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

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

export interface IntegrationTestContext {
  bot: Bot
  config: TestConfig
  arena: TestArena
  serverConsoleFile: string
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
  const container = process.env.MC_DOCKER
  if (container != null && container !== '') {
    execFileSync('docker', ['exec', '-i', container, 'sh', '-c', 'cat >> /server/console.in'], {
      input: cmd + '\n',
    })
  } else {
    appendFileSync(file, cmd + '\n')
  }
}

/**
 * Build the standard arena on the server.
 * Superflat: bedrock -64, dirt -63..-62, grass -61, ground y=-60
 * Water channel: x 0..59, z -2..2, y -63..-61
 */
export async function buildArena(bot: Bot, config: TestConfig, arena: TestArena, consoleFile: string): Promise<void> {
  const cmds = [
    'gamerule doDaylightCycle false',
    'gamerule doMobSpawning false',
    'gamerule doWeatherCycle false',
    'time set day',
    'weather clear',
    'difficulty peaceful',
    'kill @e[type=!minecraft:player]',
    'fill -6 -60 -6 66 -50 6 air',
    'fill -6 -63 -6 66 -61 6 grass_block',
    'fill 0 -63 -2 59 -61 2 water',
    `clear ${config.username}`,
    `gamemode survival ${config.username}`,
    `give ${config.username} oak_boat 1`,
    `tp ${config.username} ${arena.start.x} ${arena.start.y} ${arena.start.z} -90 30`,
  ]

  for (const cmd of cmds) sendConsoleCommand(consoleFile, cmd)

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
 * Describe block for integration tests with common lifecycle.
 * Handles server connection, arena setup, bot cleanup.
 *
 * Example:
 * ```ts
 * integrationTest('boat placement', defaultConfig, async (ctx) => {
 *   const boat = await ctx.bot.boat.place(ctx.arena.launch)
 *   expect(boat.name).toContain('boat')
 * })
 * ```
 */
export function integrationTest(
  name: string,
  config: TestConfig | (() => TestConfig),
  arena: TestArena | (() => TestArena),
  fn: (ctx: IntegrationTestContext) => Promise<void>,
): void {
  const resolveConfig = typeof config === 'function' ? config() : config
  const resolveArena = typeof arena === 'function' ? arena() : arena
  const consoleFile = resolveConfig.host === '127.0.0.1' && !process.env.MC_DOCKER ? 
    fileURLToPath(new URL('../../spike/server/run/console.in', import.meta.url)) :
    `/tmp/console-${resolveConfig.port}.in`

  describe(name, () => {
    let bot: Bot

    beforeAll(async () => {
      bot = createTestBot(resolveConfig)

      await new Promise<void>((resolve, reject) => {
        bot.on('spawn', () => resolve())
        bot.on('error', reject)
        bot.on('kicked', (reason: any) => reject(new Error(`kicked: ${reason}`)))

        setTimeout(() => reject(new Error('bot spawn timeout')), 30000)
      })

      await buildArena(bot, resolveConfig, resolveArena, consoleFile)
    })

    afterAll(async () => {
      return new Promise<void>((resolve) => {
        bot.end()
        setTimeout(resolve, 500)
      })
    })

    // Wrapper: each test gets full context
    return (fn as any)(
      async (testFn: (ctx: IntegrationTestContext) => Promise<void>) => {
        const ctx: IntegrationTestContext = {
          bot,
          config: resolveConfig,
          arena: resolveArena,
          serverConsoleFile: consoleFile,
        }
        await testFn(ctx)
      },
    )
  })
}


