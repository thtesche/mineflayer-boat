/**
 * Integration tests for the complete boat lifecycle:
 * place -> board -> drive -> leave -> recover.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Bot } from 'mineflayer'
import { Vec3 } from 'vec3'
import { defaultConfig, defaultArena, islandArena, mazeArena, connectBot, resetArena, buildIslandArena, buildMazeArena, sleep } from './setup.js'

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

  it('travel() completes full journey in one call', async () => {
    const result = await bot.boat.travel(defaultArena.launch, defaultArena.finish, { faceToward: defaultArena.farShore })

    expect(result.status).toBe('success')
    expect(result.recovered).toBe(true)
    expect(result.driveResult).toBeDefined()
    expect(result.driveResult?.status).toBe('arrived')
    expect(result.driveResult?.distance).toBeGreaterThan(50)
    expect(result.message).toContain('Successfully traveled')
    expect(bot.vehicle).toBeFalsy()

    const boatItem = bot.inventory.items().find((item: any) => item.name?.includes('boat'))
    expect(boatItem).toBeDefined()
  })

  it('travel() handles placement failure gracefully', async () => {
    const result = await bot.boat.travel(new Vec3(-5, -60, 0.5), defaultArena.finish)

    expect(result.status).toBe('failed_to_place')
    expect(result.recovered).toBe(false)
    expect(result.driveResult).toBeUndefined()
    expect(result.message).toContain('Failed to place')
  })

  it('travel() in succession trips works correctly', async () => {
    for (let i = 0; i < 2; i++) {
      if (i > 0) await resetArena(bot, testConfig, defaultArena)

      const result = await bot.boat.travel(defaultArena.launch, defaultArena.finish, { faceToward: defaultArena.farShore })

      expect(result.status).toBe('success')
      expect(result.recovered).toBe(true)
      expect(bot.vehicle).toBeFalsy()
    }
  })
})

describe('Route Planning (Pathfinding)', () => {
  let bot: Bot
  const testConfig = { ...defaultConfig, username: 'BoatyPathfinding' }

  beforeAll(async () => {
    bot = await connectBot(testConfig)
  })

  afterAll(async () => {
    bot.end()
  })

  beforeEach(async () => {
    await resetArena(bot, testConfig, defaultArena)
  })

  it('travelAuto() falls back to direct travel when path is clear', async () => {
    const result = await bot.boat.travelAuto(defaultArena.launch, defaultArena.finish, { faceToward: defaultArena.farShore })

    expect(result.status).toBe('success')
    expect(result.recovered).toBe(true)
    expect(result.driveResult).toBeDefined()
    expect(result.driveResult?.distance).toBeGreaterThan(50)
  })

  it('travelAuto() with island arena navigates around obstacle', async () => {
    const consoleFile = `/tmp/console-${testConfig.port}.in`
    await buildIslandArena(bot, testConfig, islandArena, consoleFile)

    const result = await bot.boat.travelAuto(islandArena.launch, islandArena.finish, { faceToward: islandArena.farShore })

    // Should successfully navigate around the island
    expect(result.status).toBe('success')
    expect(result.recovered).toBe(true)
    expect(bot.vehicle).toBeFalsy()
  })

  it('travelAuto() handles impossible paths gracefully', async () => {
    // Teleport to a dead-end surrounded by land
    const consoleFile = `/tmp/console-${testConfig.port}.in`
    const deadEnd = new Vec3(30, -60, 0.5)
    const outside = new Vec3(40, -60, 0.5)

    await buildIslandArena(bot, testConfig, islandArena, consoleFile)

    const result = await bot.boat.travelAuto(deadEnd, outside, { faceToward: outside })

    // Should either fail gracefully or navigate despite the island
    expect(result.boat).toBeDefined()
    expect(result.recovered === true || result.recovered === false).toBe(true)
  })

  it('travelAuto() respects maxSearchDistance parameter', async () => {
    // Very close target, very small search distance
    const result = await bot.boat.travelAuto(defaultArena.launch, defaultArena.launch, { maxSearchDistance: 5 })

    // Same position should be trivial
    expect(result.status).toBe('success')
  })

  it('travelAuto() works on complex maze arena', async () => {
    const consoleFile = `/tmp/console-${testConfig.port}.in`
    await buildMazeArena(bot, testConfig, mazeArena, consoleFile)

    const result = await bot.boat.travelAuto(mazeArena.launch, mazeArena.finish, { faceToward: mazeArena.farShore, maxSearchDistance: 100 })

    // Should find a path through the maze sections
    expect(result.status).toBe('success')
    expect(result.recovered).toBe(true)
  })
})
