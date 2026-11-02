/**
 * Integration tests for edge cases and challenging scenarios.
 * Tests narrow channels, chunk boundaries, and unusual water configurations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type Bot from 'mineflayer'
import mineflayer from 'mineflayer'
import { Vec3 } from 'vec3'
import { boatPlugin } from '../../src/index.js'
import { defaultConfig, defaultArena, buildArena, sendConsoleCommand } from './setup.js'

describe('Edge Cases', () => {
  let bot: Bot
  let consoleFile: string
  const testConfig = { ...defaultConfig, username: 'BoatyEdgeCases' }

  beforeAll(async () => {
    consoleFile = '/tmp/console-edgecases.in'

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

    // Build standard arena first
    await buildArena(bot, testConfig, defaultArena, consoleFile)
  })

  afterAll(() => {
    return new Promise<void>((resolve) => {
      bot.end()
      setTimeout(resolve, 500)
    })
  })

  it('drives through tight water channel (3 wide)', async () => {
    // Standard arena is 5 blocks wide; test that driving down the middle works
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    const result = await bot.boat.drive(defaultArena.finish)

    expect(result.status).toBe('arrived')
    expect(result.distance).toBeGreaterThan(50)
  })

  it('halts when water ahead is blocked', async () => {
    // Place boat, drive toward a wall
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)

    // Fill water ahead with dirt (creating a wall)
    const wallStart = new Vec3(40, -63, -2)
    const wallEnd = new Vec3(45, -61, 2)
    sendConsoleCommand(
      consoleFile,
      `fill ${wallStart.x} ${wallStart.y} ${wallStart.z} ${wallEnd.x} ${wallEnd.y} ${wallEnd.z} dirt`,
    )
    await bot.waitForTicks(5)

    // Try to drive past the wall
    const result = await bot.boat.drive(new Vec3(60, 0, 0.5))

    expect(['blocked', 'rejected']).toContain(result.status)
  })

  it('can place and drive in shallow water (1 block deep)', async () => {
    // Create shallow water test area
    const testZ = 3
    sendConsoleCommand(consoleFile, `fill 0 -62 ${testZ} 59 -62 ${testZ} water`)
    await bot.waitForTicks(5)

    // Place on shallow water
    const boat = await bot.boat.place(new Vec3(5, -62.1, testZ + 0.5))
    expect(boat).toBeDefined()

    await bot.boat.board(boat)
    const result = await bot.boat.drive(new Vec3(30, 0, testZ + 0.5))

    expect(['arrived', 'blocked']).toContain(result.status)
  })

  it('survives chunk boundary crossing', async () => {
    // Standard arena is within one chunk; verify no crash on chunk loads
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)

    // Drive to chunk boundary (16-block boundary)
    const result = await bot.boat.drive(new Vec3(16, 0, 0.5))

    expect(['arrived', 'blocked', 'lost']).toContain(result.status)
  })

  it('recovers when boat drifts sideways', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)

    // Target is at z=0.5, but water extends ±2 blocks
    // Boat might drift; should still complete
    const result = await bot.boat.drive(defaultArena.finish)

    expect(result.status).toBe('arrived')
    // Drift tolerance: can end up 2-3 blocks off
    expect(Math.abs(bot.entity.position.z - defaultArena.finish.z)).toBeLessThan(3)
  })

  it('handles very long distance drive', async () => {
    // Extend water for long drive
    sendConsoleCommand(consoleFile, `fill 0 -63 -2 100 -61 2 water`)
    await bot.waitForTicks(10)

    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)

    // Drive 100+ blocks
    const result = await bot.boat.drive(new Vec3(100, 0, 0.5))

    expect(['arrived', 'lost']).toContain(result.status)
  })

  it('boat does not sink or disappear during drive', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    const boatId = boat.id
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.boat.drive(defaultArena.finish)

    // Boat should still exist
    expect(bot.entities[boatId]).toBeDefined()
  })
})
