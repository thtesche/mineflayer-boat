/**
 * Integration tests for the complete boat lifecycle:
 * place → board → drive → leave → recover
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type Bot from 'mineflayer'
import mineflayer from 'mineflayer'
import { Vec3 } from 'vec3'
import { boatPlugin } from '../../src/index.js'
import { defaultConfig, defaultArena, buildArena } from './setup.js'

describe('Boat Lifecycle', () => {
  let bot: Bot
  const testConfig = { ...defaultConfig, username: 'BoatyLifecycle' }

  beforeAll(async () => {
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

    const consoleFile = '/tmp/console-lifecycle.in'
    await buildArena(bot, testConfig, defaultArena, consoleFile)
  })

  afterAll(() => {
    return new Promise<void>((resolve) => {
      bot.end()
      setTimeout(resolve, 500)
    })
  })

  it('completes full journey: place → board → drive → leave → recover', async () => {
    // Place
    const boat = await bot.boat.place(defaultArena.launch)
    expect(boat.name).toMatch(/boat/)
    await bot.waitForTicks(10)

    // Board
    await bot.boat.board(boat)
    expect(bot.vehicle?.id).toBe(boat.id)

    // Drive
    const result = await bot.boat.drive(defaultArena.finish)
    expect(result.status).toBe('arrived')
    expect(result.distance).toBeGreaterThan(50)

    // Leave
    await bot.boat.leave({ faceToward: defaultArena.farShore })
    expect(bot.vehicle).toBeUndefined()

    // Recover
    const recovered = await bot.boat.recover(boat)
    expect(recovered).toBe(true)

    // Verify boat item back in inventory
    const boatItem = bot.inventory
      .items()
      .find((item: any) => item.name && item.name.includes('boat'))
    expect(boatItem).toBeDefined()
  })

  it('handles quick succession of trips', async () => {
    for (let i = 0; i < 3; i++) {
      const boat = await bot.boat.place(defaultArena.launch)
      await bot.waitForTicks(5)

      await bot.boat.board(boat)
      await bot.boat.drive(defaultArena.finish)
      await bot.boat.leave({ faceToward: defaultArena.farShore })
      await bot.boat.recover(boat)

      expect(bot.vehicle).toBeUndefined()
      expect(
        bot.inventory.items().find((item: any) => item.name && item.name.includes('boat')),
      ).toBeDefined()
    }
  })

  it('dismounts to correct shore position', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    const startPos = bot.entity.position.clone()

    await bot.boat.drive(defaultArena.finish)
    const driveEndPos = bot.entity.position.clone()

    await bot.boat.leave({ faceToward: defaultArena.farShore })

    // Bot should be on far shore, not in water
    const positionBlock = bot.blockAt(bot.entity.position)
    expect(positionBlock?.name).not.toBe('water')

    // Distance traveled > distance to far shore
    expect(driveEndPos.distanceTo(startPos)).toBeGreaterThan(40)
  })

  it('emits boat events in correct order', async () => {
    const events: string[] = []

    bot.on('mount', () => events.push('mount'))
    bot.on('dismount', () => events.push('dismount'))

    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.waitForTicks(2)
    await bot.boat.drive(defaultArena.finish)
    await bot.boat.leave()

    // Should see mount, then dismount
    const mountIdx = events.indexOf('mount')
    const dismountIdx = events.indexOf('dismount')

    expect(mountIdx).toBeGreaterThanOrEqual(0)
    expect(dismountIdx).toBeGreaterThan(mountIdx)
  })
})
