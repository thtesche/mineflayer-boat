/**
 * Integration tests for edge cases: blocked water, long distances, chunk
 * crossings and sideways drift. Each test starts from a reset arena; tests
 * that reshape the world outside the standard channel clean up implicitly on
 * the next reset (which refills x 0..59).
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Bot } from 'mineflayer'
import { Vec3 } from 'vec3'
import { defaultConfig, defaultArena, connectBot, resetArena, sendConsoleCommand, sleep } from './setup.js'

describe('Edge Cases', () => {
  let bot: Bot
  const testConfig = { ...defaultConfig, username: 'BoatyEdgeCases' }
  const consoleFile = `/tmp/console-${testConfig.port}.in`

  beforeAll(async () => {
    bot = await connectBot(testConfig)
  })

  beforeEach(async () => {
    await resetArena(bot, testConfig, defaultArena)
  })

  afterAll(() => {
    return new Promise<void>((resolve) => {
      bot.end()
      setTimeout(resolve, 500)
    })
  })

  it('drives down the middle of the channel', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    const result = await bot.boat.drive(defaultArena.finish)

    expect(result.status).toBe('arrived')
    expect(result.distance).toBeGreaterThan(50)
  })

  it('halts when water ahead is blocked', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)
    await bot.boat.board(boat)

    // Wall of dirt across the channel at x 40..45.
    sendConsoleCommand(consoleFile, 'fill 40 -63 -2 45 -61 2 dirt')
    await sleep(500) // mounted: physicsTick is paused, so sleep instead of waitForTicks

    const result = await bot.boat.drive(new Vec3(60, 0, 0.5))

    expect(['blocked', 'rejected']).toContain(result.status)
  })

  // Placing on 1-block-deep water is an unverified edge case: the plugin
  // targets open water, and such a spot sits out of reach of the start shore.
  it.skip('can place and drive in shallow water (1 block deep)', async () => {})

  it('survives a short drive across a chunk boundary', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    const result = await bot.boat.drive(new Vec3(16, 0, 0.5))

    expect(['arrived', 'blocked', 'lost']).toContain(result.status)
  })

  it('stays near its lane despite sideways drift', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    const result = await bot.boat.drive(defaultArena.finish)

    expect(result.status).toBe('arrived')
    expect(Math.abs(bot.entity.position.z - defaultArena.finish.z)).toBeLessThan(3)
  })

  it('handles a very long distance drive', async () => {
    sendConsoleCommand(consoleFile, 'fill 0 -63 -2 100 -61 2 water')
    await bot.waitForTicks(10)

    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    const result = await bot.boat.drive(new Vec3(100, 0, 0.5))

    expect(['arrived', 'lost']).toContain(result.status)
  })

  it('boat does not disappear during a drive', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    const boatId = boat.id
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.boat.drive(defaultArena.finish)

    expect(bot.entities[boatId]).toBeDefined()
  })
})
