/**
 * Integration tests for boat driving at various cruise speeds.
 * Drive tick counts are deterministic (the simulation advances one tick per
 * step regardless of wall-clock), so the windows below are stable.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Bot } from 'mineflayer'
import { type DriveResult } from '../../src/index.js'
import { defaultConfig, defaultArena, connectBot, resetArena, sleep } from './setup.js'

interface SpeedTest {
  cruiseSpeed: number
  expectedTicks: { min: number; max: number }
  expectedAvgSpeed: { min: number; max: number }
}

const speedTests: SpeedTest[] = [
  {
    cruiseSpeed: 0.25,
    expectedTicks: { min: 200, max: 280 },
    expectedAvgSpeed: { min: 0.2, max: 0.3 },
  },
  {
    cruiseSpeed: 0.3,
    expectedTicks: { min: 180, max: 220 },
    expectedAvgSpeed: { min: 0.26, max: 0.32 },
  },
  {
    cruiseSpeed: 0.4,
    expectedTicks: { min: 130, max: 180 },
    expectedAvgSpeed: { min: 0.31, max: 0.45 },
  },
]

describe('Boat Driving - Speed Variations', () => {
  let bot: Bot
  const testConfig = { ...defaultConfig, username: 'BoatySpeed' }

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

  speedTests.forEach((test) => {
    it(`drives at cruise speed ${test.cruiseSpeed} b/t`, async () => {
      const boat = await bot.boat.place(defaultArena.launch)
      await bot.waitForTicks(10)

      await bot.boat.board(boat)
      await sleep(250) // mounted: physicsTick is paused, so sleep instead of waitForTicks

      bot.boat.options.kinematics.cruiseSpeed = test.cruiseSpeed

      const result: DriveResult = await bot.boat.drive(defaultArena.finish)

      expect(result.status).toBe('arrived')
      expect(result.ticks).toBeGreaterThanOrEqual(test.expectedTicks.min)
      expect(result.ticks).toBeLessThanOrEqual(test.expectedTicks.max)
      expect(result.averageSpeed).toBeGreaterThanOrEqual(test.expectedAvgSpeed.min)
      expect(result.averageSpeed).toBeLessThanOrEqual(test.expectedAvgSpeed.max)
      expect(result.corrections).toBeLessThanOrEqual(3)
    })
  })

  it('maintains stable velocity during cruise', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await sleep(250) // mounted: physicsTick is paused, so sleep instead of waitForTicks

    bot.boat.options.kinematics.cruiseSpeed = 0.3

    const result = await bot.boat.drive(defaultArena.finish)

    expect(result.averageSpeed).toBeGreaterThan(0.26)
    expect(result.topSpeed).toBeLessThanOrEqual(0.31)
  })
})
