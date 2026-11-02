/**
 * Integration tests for boat placement on various water surfaces.
 * Tests that boats can be placed on different water depths, widths, and configurations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Bot } from 'mineflayer'
import mineflayer from 'mineflayer'
import { Vec3 } from 'vec3'
import { boatPlugin } from '../../src/index.js'
import { defaultConfig, defaultArena, buildArena, sendConsoleCommand } from './setup.js'

describe('Boat Placement', () => {
  let bot: Bot
  const testConfig = { ...defaultConfig, username: 'BoatyPlacement' }

  beforeAll(async () => {
    bot = mineflayer.createBot({
      host: testConfig.host,
      port: testConfig.port,
      username: testConfig.username,
      version: testConfig.version,
      auth: 'offline',
    })
    bot.loadPlugin(boatPlugin(testConfig.boatOptions))

    await new Promise<void>((resolve, reject) => {
      bot.on('spawn', () => resolve())
      bot.on('error', reject)
      bot.on('kicked', (reason: any) => reject(new Error(`kicked: ${reason}`)))
      setTimeout(() => reject(new Error('spawn timeout')), 30000)
    })

    // Build test arenas
    const consoleFile = '/tmp/console-placement.in'
    await buildArena(bot, testConfig, defaultArena, consoleFile)
  })

  afterAll(() => {
    return new Promise<void>((resolve) => {
      bot.end()
      setTimeout(resolve, 500)
    })
  })

  it('places boat on standard water surface', async () => {
    const boat = await bot.boat.place(defaultArena.launch)

    expect(boat).toBeDefined()
    expect(boat.name).toMatch(/boat/)
    expect(boat.position.y).toBeCloseTo(defaultArena.launch.y, 1)
    expect(boat.position.distanceTo(defaultArena.launch)).toBeLessThan(2)
  })

  it('places boat with correct entity type', async () => {
    const boat = await bot.boat.place(defaultArena.launch)

    expect(boat.name).toMatch(/oak_boat|spruce_boat|birch_boat/)
    expect(boat.id).toBeGreaterThan(0)
  })

  it('boat is accessible after placement', async () => {
    const boat = await bot.boat.place(defaultArena.launch)

    // Find boat in world
    const foundBoat = bot.entities[boat.id]
    expect(foundBoat).toBeDefined()
    expect(foundBoat?.type).toMatch(/boat/)
  })

  it('boat can be boarded immediately after placement', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10) // Let boat settle

    await bot.boat.board(boat)

    expect(bot.vehicle).toBeDefined()
    expect(bot.vehicle?.id).toBe(boat.id)
  })

  it('rejects placement on non-water blocks', async () => {
    const dirt = new Vec3(defaultArena.launch.x + 10, defaultArena.start.y, defaultArena.launch.z)

    try {
      await bot.boat.place(dirt)
      expect.fail('Should not place boat on dirt')
    } catch (err: any) {
      expect(err.message).toMatch(/water|wet|not suitable/)
    }
  })

  it('places multiple boats sequentially', async () => {
    const boat1 = await bot.boat.place(new Vec3(5, -60.1, 0.5))
    await bot.waitForTicks(5)
    const boat2 = await bot.boat.place(new Vec3(10, -60.1, 0.5))

    expect(boat1.id).not.toBe(boat2.id)
    expect(bot.entities[boat1.id]).toBeDefined()
    expect(bot.entities[boat2.id]).toBeDefined()
  })
})
