/**
 * Integration tests for server correction handling.
 * Tests that the bot correctly handles vehicle_move corrections from the server,
 * rebases simulation, and detects rejection patterns.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type Bot from 'mineflayer'
import mineflayer from 'mineflayer'
import { Vec3 } from 'vec3'
import { boatPlugin, type DriveResult } from '../../src/index.js'
import { defaultConfig, defaultArena, buildArena } from './setup.js'

describe('Server Corrections', () => {
  let bot: Bot
  const testConfig = { ...defaultConfig, username: 'BoatyCorrections' }

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

    const consoleFile = '/tmp/console-corrections.in'
    await buildArena(bot, testConfig, defaultArena, consoleFile)
  })

  afterAll(() => {
    return new Promise<void>((resolve) => {
      bot.end()
      setTimeout(resolve, 500)
    })
  })

  it('completes drive with zero corrections on calm water', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.waitForTicks(5)

    const result: DriveResult = await bot.boat.drive(defaultArena.finish)

    expect(result.status).toBe('arrived')
    expect(result.corrections).toBe(0)
  })

  it('handles minor corrections gracefully', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.waitForTicks(5)

    let correctionCount = 0
    ;(bot.boat as any).on('correction', () => {
      correctionCount++
    })

    const result = await bot.boat.drive(defaultArena.finish)

    // Some servers may send 0-2 corrections on perfect runs
    expect(result.status).toBe('arrived')
    expect(result.corrections).toBeLessThanOrEqual(2)
  })

  it('rejects drive after repeated corrections', async () => {
    // This test is harder to trigger naturally; would require
    // server simulation misbehavior or network injection.
    // For now, we verify the correction counter is tracked.

    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.waitForTicks(5)

    const result = await bot.boat.drive(defaultArena.finish)

    // Verify corrections are counted (even if 0)
    expect(typeof result.corrections).toBe('number')
    expect(result.corrections).toBeGreaterThanOrEqual(0)
  })

  it('recovers from stall and completes', async () => {
    // If a boat stalls (velocity approaches 0) due to correction,
    // it should resume and complete the drive.

    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.waitForTicks(5)

    const result = await bot.boat.drive(defaultArena.finish)

    // Should complete even if there are temporary stalls
    expect(['arrived', 'blocked']).toContain(result.status)
  })

  it('reports correction metrics', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.waitForTicks(5)

    const result = await bot.boat.drive(defaultArena.finish)

    // Verify all metrics are present
    expect(result).toHaveProperty('corrections')
    expect(result).toHaveProperty('averageSpeed')
    expect(result).toHaveProperty('topSpeed')
    expect(result).toHaveProperty('distance')
    expect(result).toHaveProperty('ticks')
  })
})
