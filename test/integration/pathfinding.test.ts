/**
 * Integration tests for route planning: travelAuto() places once, drives the
 * A* route around obstacles while mounted, then recovers once.
 *
 * These live drives are long and run in their own CI job against a freshly
 * started server, so they do not pile cumulative load onto the main
 * integration suite (which shares a single server across all its files).
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Bot } from 'mineflayer'
import {
  defaultConfig,
  defaultArena,
  islandArena,
  impossibleArena,
  connectBot,
  resetArena,
  buildIslandArena,
  buildImpossibleArena,
} from './setup.js'

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

  it('travelAuto() fails gracefully and recovers when no route exists', async () => {
    const consoleFile = `/tmp/console-${testConfig.port}.in`
    await buildImpossibleArena(bot, testConfig, impossibleArena, consoleFile)

    const result = await bot.boat.travelAuto(impossibleArena.launch, impossibleArena.finish, { faceToward: impossibleArena.farShore })

    // No water path exists, so travelAuto falls back to a direct drive that the
    // full-width wall blocks. It must still place, leave and recover the boat
    // rather than throw or strand it mounted.
    expect(result.status).not.toBe('success')
    expect(result.boat).toBeDefined()
    expect(result.recovered).toBe(true)
    expect(bot.vehicle).toBeFalsy()
  })

  it('travelAuto() respects maxSearchDistance parameter', async () => {
    // Very close target, very small search distance
    const result = await bot.boat.travelAuto(defaultArena.launch, defaultArena.launch, { maxSearchDistance: 5 })

    // Same position should be trivial
    expect(result.status).toBe('success')
  })
})
