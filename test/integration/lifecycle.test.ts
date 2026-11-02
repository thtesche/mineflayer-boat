/**
 * Integration tests for the complete boat lifecycle:
 * place -> board -> drive -> leave -> recover.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Bot } from 'mineflayer'
import { defaultConfig, defaultArena, connectBot, resetArena, sleep } from './setup.js'

describe('Boat Lifecycle', () => {
  let bot: Bot
  const testConfig = { ...defaultConfig, username: 'BoatyLifecycle' }

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

  it('completes full journey: place -> board -> drive -> leave -> recover', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    expect(boat.name).toMatch(/boat/)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    expect(bot.vehicle?.id).toBe(boat.id)

    const result = await bot.boat.drive(defaultArena.finish)
    expect(result.status).toBe('arrived')
    expect(result.distance).toBeGreaterThan(50)

    await bot.boat.leave({ faceToward: defaultArena.farShore })
    expect(bot.vehicle).toBeFalsy()

    const recovered = await bot.boat.recover(boat)
    expect(recovered).toBe(true)

    const boatItem = bot.inventory.items().find((item: any) => item.name?.includes('boat'))
    expect(boatItem).toBeDefined()
  })

  it('handles quick succession of trips', async () => {
    for (let i = 0; i < 3; i++) {
      // Each trip strands the bot on the far shore; reset puts it back. The
      // first trip reuses beforeEach's reset — resetting twice back to back
      // (kill/fill/tp overlapping before the bot settles) desyncs the boat.
      if (i > 0) await resetArena(bot, testConfig, defaultArena)

      const boat = await bot.boat.place(defaultArena.launch)
      await bot.waitForTicks(5)

      await bot.boat.board(boat)
      await bot.boat.drive(defaultArena.finish)
      await bot.boat.leave({ faceToward: defaultArena.farShore })
      await bot.boat.recover(boat)

      expect(bot.vehicle).toBeFalsy()
      expect(bot.inventory.items().find((item: any) => item.name?.includes('boat'))).toBeDefined()
    }
  })

  it('dismounts onto the far shore, not into water', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    const startPos = bot.entity.position.clone()

    await bot.boat.drive(defaultArena.finish)
    const driveEndPos = bot.entity.position.clone()

    await bot.boat.leave({ faceToward: defaultArena.farShore })

    const positionBlock = bot.blockAt(bot.entity.position)
    expect(positionBlock?.name).not.toBe('water')
    expect(driveEndPos.distanceTo(startPos)).toBeGreaterThan(40)
  })

  it('emits mount before dismount', async () => {
    const events: string[] = []
    bot.on('mount', () => {
      events.push('mount')
    })
    bot.on('dismount', () => {
      events.push('dismount')
    })

    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await sleep(100) // mounted: physicsTick is paused, so sleep instead of waitForTicks
    await bot.boat.drive(defaultArena.finish)
    await bot.boat.leave({ faceToward: defaultArena.farShore })

    const mountIdx = events.indexOf('mount')
    const dismountIdx = events.indexOf('dismount')
    expect(mountIdx).toBeGreaterThanOrEqual(0)
    expect(dismountIdx).toBeGreaterThan(mountIdx)
  })
})
