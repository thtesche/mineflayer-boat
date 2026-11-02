/**
 * Integration tests for dismount mechanics (entity_action sneak dismount).
 * Dismounting mid-water leaves the bot swimming, so landing assertions drive
 * all the way to the far shore first.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Bot } from 'mineflayer'
import { Vec3 } from 'vec3'
import { defaultConfig, defaultArena, connectBot, resetArena, sleep } from './setup.js'

describe('Dismount Mechanics', () => {
  let bot: Bot
  const testConfig = { ...defaultConfig, username: 'BoatyDismount' }

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

  it('dismounts onto the shore after a drive', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    expect(bot.vehicle?.id).toBe(boat.id)

    const result = await bot.boat.drive(defaultArena.finish)
    expect(result.status).toBe('arrived')

    await bot.boat.leave({ faceToward: defaultArena.farShore })
    await bot.waitForTicks(10)

    expect(bot.vehicle).toBeFalsy()
    expect(bot.entity.onGround).toBe(true)
  })

  it('dismounts to the specified shore position', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.boat.drive(defaultArena.finish)

    const farShorePos = new Vec3(62, -60, 0.5)
    await bot.boat.leave({ faceToward: farShorePos })
    await bot.waitForTicks(10)

    expect(bot.entity.position.distanceTo(farShorePos)).toBeLessThan(3)

    const blockBelow = bot.blockAt(bot.entity.position.offset(0, -1, 0))
    expect(['grass_block', 'dirt']).toContain(blockBelow?.name)
  })

  it('dismounts onto the side of the boat nearest the target', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.boat.drive(defaultArena.finish)

    // faceToward only controls which side vanilla sets the rider down on, not
    // the final heading (the dismount teleport resets yaw). The far shore is at
    // +x, so the rider should land on the +x side of the boat, never behind it.
    const boatX = boat.position.x
    await bot.boat.leave({ faceToward: new Vec3(65, -60, 0.5) })

    expect(bot.entity.position.x).toBeGreaterThanOrEqual(boatX - 0.5)
  })

  it('emits a dismount event', async () => {
    let dismounted = false
    const listener = (): void => {
      dismounted = true
    }
    bot.on('dismount', listener)

    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await sleep(250) // mounted: physicsTick is paused, so sleep instead of waitForTicks
    await bot.boat.drive(defaultArena.finish)
    await bot.boat.leave({ faceToward: defaultArena.farShore })

    bot.removeListener('dismount', listener)
    expect(dismounted).toBe(true)
  })

  it('leaving while not in a boat is a no-op', async () => {
    await expect(bot.boat.leave()).resolves.toBeUndefined()
    expect(bot.vehicle).toBeFalsy()
  })

  it('a second leave after dismounting is a safe no-op', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.boat.drive(defaultArena.finish)

    await bot.boat.leave({ faceToward: defaultArena.farShore })
    expect(bot.vehicle).toBeFalsy()

    // leave() returns immediately when the bot is no longer in a boat.
    await expect(bot.boat.leave()).resolves.toBeUndefined()
    expect(bot.vehicle).toBeFalsy()
  })
})
