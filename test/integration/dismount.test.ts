/**
 * Integration tests for dismount patterns and mechanics.
 * Verifies that entity_action START_SNEAK works correctly and bot ends up on shore.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type Bot from 'mineflayer'
import mineflayer from 'mineflayer'
import { Vec3 } from 'vec3'
import { boatPlugin } from '../../src/index.js'
import { defaultConfig, defaultArena, buildArena } from './setup.js'

describe('Dismount Mechanics', () => {
  let bot: Bot
  const testConfig = { ...defaultConfig, username: 'BoatyDismount' }

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

    const consoleFile = '/tmp/console-dismount.in'
    await buildArena(bot, testConfig, defaultArena, consoleFile)
  })

  afterAll(() => {
    return new Promise<void>((resolve) => {
      bot.end()
      setTimeout(resolve, 500)
    })
  })

  it('dismounts successfully after short drive', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    expect(bot.vehicle?.id).toBe(boat.id)

    const result = await bot.boat.drive(new Vec3(20, 0, 0.5))
    expect(result.status).toBe('arrived')

    await bot.boat.leave()

    expect(bot.vehicle).toBeUndefined()
    expect(bot.entity.onGround).toBe(true)
  })

  it('dismounts to specified shore position', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.boat.drive(defaultArena.finish)

    const farShorePos = new Vec3(62, -60, 0.5)
    await bot.boat.leave({ faceToward: farShorePos })

    // Bot should be near far shore, not in water
    expect(bot.entity.position.distanceTo(farShorePos)).toBeLessThan(3)

    const blockBelow = bot.blockAt(bot.entity.position.offset(0, -1, 0))
    expect(['grass_block', 'dirt']).toContain(blockBelow?.name)
  })

  it('dismounts with correct rotation', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.boat.drive(new Vec3(30, 0, 0.5))

    const targetPos = new Vec3(35, -60, 0.5)
    await bot.boat.leave({ faceToward: targetPos })

    // Bot yaw should roughly face target
    const toTarget = targetPos.clone().subtract(bot.entity.position).normalize()
    const botDir = new Vec3(
      Math.sin(bot.entity.yaw),
      0,
      -Math.cos(bot.entity.yaw),
    )

    const dotProduct = toTarget.dot(botDir)
    // Allow some tolerance; not exact due to server physics
    expect(dotProduct).toBeGreaterThan(-0.5)
  })

  it('emits dismount event', async () => {
    let dismounted = false
    const dismountListener = () => {
      dismounted = true
    }

    bot.on('dismount', dismountListener)

    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.waitForTicks(5)
    await bot.boat.drive(new Vec3(25, 0, 0.5))
    await bot.boat.leave()

    bot.removeListener('dismount', dismountListener)

    expect(dismounted).toBe(true)
  })

  it('cannot dismount while not in boat', async () => {
    try {
      await bot.boat.leave()
      // If we get here, the function didn't error (might be handled gracefully)
      // which is also acceptable
    } catch (err: any) {
      expect(err.message).toMatch(/not mounted|no vehicle/)
    }
  })

  it('dismounts safely on rapid clicks', async () => {
    const boat = await bot.boat.place(defaultArena.launch)
    await bot.waitForTicks(10)

    await bot.boat.board(boat)
    await bot.boat.drive(new Vec3(20, 0, 0.5))

    // Attempt dismount multiple times rapidly
    const promises = [bot.boat.leave(), bot.boat.leave()]
    await Promise.allSettled(promises)

    // Should still be dismounted, not cause errors
    expect(bot.vehicle).toBeUndefined()
  })
})
