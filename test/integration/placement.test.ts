/**
 * Integration tests for boat placement.
 * Covers placing on water, the spawned entity, boarding, and the no-boat
 * rejection path. Each test starts from a freshly reset arena.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Bot } from 'mineflayer'
import { Vec3 } from 'vec3'
import { defaultConfig, defaultArena, connectBot, resetArena, sendConsoleCommand } from './setup.js'

describe('Boat Placement', () => {
  let bot: Bot
  const testConfig = { ...defaultConfig, username: 'BoatyPlacement' }
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

  it('places boat on standard water surface', async () => {
    const boat = await bot.boat.place(defaultArena.launch)

    expect(boat).toBeDefined()
    expect(boat.name).toMatch(/boat/)
    expect(boat.position.distanceTo(defaultArena.launch)).toBeLessThan(2)
  })

  it('places a boat of the expected wood type', async () => {
    const boat = await bot.boat.place(defaultArena.launch)

    expect(boat.name).toBe('oak_boat')
    expect(boat.id).toBeGreaterThan(0)
  })

  it('boat is present in the world after placement', async () => {
    const boat = await bot.boat.place(defaultArena.launch)

    const found = bot.entities[boat.id]
    expect(found).toBeDefined()
    expect(found?.name).toMatch(/boat/)
  })

  it('boat can be boarded immediately after placement', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10) // let the boat settle

    await bot.boat.board(boat)

    expect(bot.vehicle).toBeTruthy()
    expect(bot.vehicle?.id).toBe(boat.id)
  })

  it('rejects placement when no boat is in the inventory', async () => {
    sendConsoleCommand(consoleFile, `clear ${testConfig.username}`)
    const deadline = Date.now() + 3000
    while (bot.boat.findItem() != null && Date.now() < deadline) await bot.waitForTicks(2)

    await expect(bot.boat.place(defaultArena.launch)).rejects.toThrow(/no_boat/)
  })

  it('places multiple boats sequentially', async () => {
    // buildArena only gives one boat; stock a few more for this test.
    sendConsoleCommand(consoleFile, `give ${testConfig.username} oak_boat 5`)
    const deadline = Date.now() + 3000
    while ((bot.boat.findItem()?.count ?? 0) < 2 && Date.now() < deadline) await bot.waitForTicks(2)

    // Two lanes so the second placement's ray does not hit the first boat.
    const boat1 = await bot.boat.place(new Vec3(2.0, -60.1, -1.0))
    await bot.waitForTicks(5)
    const boat2 = await bot.boat.place(new Vec3(2.0, -60.1, 1.5))

    expect(boat1.id).not.toBe(boat2.id)
    expect(bot.entities[boat1.id]).toBeDefined()
    expect(bot.entities[boat2.id]).toBeDefined()
  })
})
