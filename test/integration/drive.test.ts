/**
 * Integration tests for boat driving at various cruise speeds.
 * Tests acceleration, terminal velocity, and control responsiveness.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Bot } from 'mineflayer'
import mineflayer from 'mineflayer'
import { Vec3 } from 'vec3'
import { boatPlugin, type DriveResult } from '../../src/index.js'
import { defaultConfig, defaultArena, buildArena } from './setup.js'

interface SpeedTest {
  cruiseSpeed: number
  expectedTicks: { min: number; max: number }
  expectedAvgSpeed: { min: number; max: number }
}

const speedTests: SpeedTest[] = [
  {
    cruiseSpeed: 0.25,
    expectedTicks: { min: 200, max: 280 },
    expectedAvgSpeed: { min: 0.20, max: 0.30 },
  },
  {
    cruiseSpeed: 0.30,
    expectedTicks: { min: 180, max: 220 },
    expectedAvgSpeed: { min: 0.26, max: 0.32 },
  },
  {
    cruiseSpeed: 0.40,
    expectedTicks: { min: 130, max: 180 },
    expectedAvgSpeed: { min: 0.31, max: 0.45 },
  },
]

describe('Boat Driving - Speed Variations', () => {
  let botTemplate: Bot

  beforeAll(async () => {
    botTemplate = mineflayer.createBot({
      host: defaultConfig.host,
      port: defaultConfig.port,
      username: 'BoatySpeed',
      version: defaultConfig.version,
      auth: 'offline',
    })
    botTemplate.loadPlugin(boatPlugin())

    await new Promise<void>((resolve, reject) => {
      botTemplate.on('spawn', () => resolve())
      botTemplate.on('error', reject)
      setTimeout(() => reject(new Error('spawn timeout')), 30000)
    })

    const consoleFile = '/tmp/console-drive.in'
    await buildArena(botTemplate, defaultConfig, defaultArena, consoleFile)
  })

  afterAll(() => {
    return new Promise<void>((resolve) => {
      botTemplate.end()
      setTimeout(resolve, 500)
    })
  })

  speedTests.forEach((test) => {
    it(`drives at cruise speed ${test.cruiseSpeed} b/t`, async () => {
      const bot = botTemplate

      const boat = await bot.boat.place(defaultArena.launch)
      await bot.waitForTicks(10)

      await bot.boat.board(boat)
      await bot.waitForTicks(5)

      // Override cruise speed temporarily
      ;(bot.boat as any).state.kinematics.cruiseSpeed = test.cruiseSpeed

      const result: DriveResult = await bot.boat.drive(defaultArena.finish)

      expect(result.status).toBe('arrived')
      expect(result.ticks).toBeGreaterThanOrEqual(test.expectedTicks.min)
      expect(result.ticks).toBeLessThanOrEqual(test.expectedTicks.max)
      expect(result.averageSpeed).toBeGreaterThanOrEqual(test.expectedAvgSpeed.min)
      expect(result.averageSpeed).toBeLessThanOrEqual(test.expectedAvgSpeed.max)
      expect(result.corrections).toBeLessThanOrEqual(3) // Max 3 corrections tolerated
    })
  })

  it('maintains stable velocity during cruise', async () => {
    const bot = botTemplate
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.waitForTicks(5)

    ;(bot.boat as any).state.kinematics.cruiseSpeed = 0.30

    const result = await bot.boat.drive(defaultArena.finish)

    // Speed variance should be small (>80% of runs hit target speed)
    expect(result.averageSpeed).toBeGreaterThan(0.26)
    expect(result.topSpeed).toBeLessThan(0.35)
  })
})
