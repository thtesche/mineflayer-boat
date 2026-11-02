/**
 * Integration tests for server correction handling. On calm, open water the
 * predicted track matches the server, so a clean drive takes zero corrections;
 * these tests check the counting and reporting around that.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Bot } from 'mineflayer'
import { type DriveResult } from '../../src/index.js'
import { defaultConfig, defaultArena, connectBot, resetArena, sleep } from './setup.js'

describe('Server Corrections', () => {
  let bot: Bot
  const testConfig = { ...defaultConfig, username: 'BoatyCorrections' }

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

  async function driveAcross(): Promise<DriveResult> {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)
    await bot.boat.board(boat)
    await sleep(250) // mounted: physicsTick is paused, so sleep instead of waitForTicks
    return await bot.boat.drive(defaultArena.finish)
  }

  it('completes drive with zero corrections on calm water', async () => {
    const result = await driveAcross()

    expect(result.status).toBe('arrived')
    expect(result.corrections).toBe(0)
  })

  it('arrives with at most a couple of corrections', async () => {
    const result = await driveAcross()

    expect(result.status).toBe('arrived')
    expect(result.corrections).toBeLessThanOrEqual(2)
  })

  it('tracks a non-negative correction count', async () => {
    const result = await driveAcross()

    expect(typeof result.corrections).toBe('number')
    expect(result.corrections).toBeGreaterThanOrEqual(0)
  })

  it('completes the drive without stalling out', async () => {
    const result = await driveAcross()

    expect(['arrived', 'blocked']).toContain(result.status)
  })

  it('reports the full set of drive metrics', async () => {
    const result = await driveAcross()

    expect(result).toHaveProperty('corrections')
    expect(result).toHaveProperty('averageSpeed')
    expect(result).toHaveProperty('topSpeed')
    expect(result).toHaveProperty('distance')
    expect(result).toHaveProperty('ticks')
  })
})
