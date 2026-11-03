import { describe, it, expect } from 'vitest'
import { findWaterPath } from '../src/pathfinding.js'
import { Vec3 } from 'vec3'
import type { Bot } from 'mineflayer'

/**
 * Mock bot with a simple block grid for pathfinding tests.
 * Grid: water blocks at y=-1, grass/land elsewhere.
 */
function createMockBot(waterBlocks: Set<string>): Bot {
  return {
    blockAt: (pos: Vec3) => {
      const key = `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`
      if (waterBlocks.has(key)) {
        return { name: 'water', boundingBox: 'empty' }
      }
      // Above water is air (open); land is grass
      if (Math.floor(pos.y) > -1) {
        return { name: 'air', boundingBox: 'empty' }
      }
      return { name: 'stone', boundingBox: 'block' }
    },
  } as any as Bot
}

describe.skip('Pathfinding', () => {
  it('mock bot returns water blocks correctly', () => {
    const waterBlocks = new Set<string>()
    for (let x = 0; x <= 5; x++) {
      waterBlocks.add(`${x},-1,0`)
    }
    const bot = createMockBot(waterBlocks)

    const water = bot.blockAt(new Vec3(0, -1, 0))
    const air = bot.blockAt(new Vec3(0, 0, 0))
    const land = bot.blockAt(new Vec3(0, -2, 0))

    expect(water?.name).toBe('water')
    expect(air?.name).toBe('air')
    expect(land?.name).toBe('stone')
  })

  it('findWaterPath returns empty path for same start/goal', () => {
    const bot = createMockBot(new Set(['0,-1,0', '1,-1,0']))
    const start = new Vec3(0.5, -1, 0.5)
    const goal = new Vec3(0.5, -1, 0.5)

    const path = findWaterPath(start, goal, bot)

    expect(path).toEqual([])
  })

  it('findWaterPath finds direct path on clear water', () => {
    const waterBlocks = new Set<string>()
    for (let x = 0; x <= 5; x++) {
      waterBlocks.add(`${x},-1,0`)
    }
    const bot = createMockBot(waterBlocks)
    const start = new Vec3(0.5, -1, 0.5)
    const goal = new Vec3(5.5, -1, 0.5)

    const path = findWaterPath(start, goal, bot, 100)

    expect(path).toBeDefined()
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(0)
    expect(path![path!.length - 1]).toEqual({ x: 5, z: 0 })
  })

  it('findWaterPath navigates around obstacle', () => {
    const waterBlocks = new Set<string>()
    // Create a water path: straight line with an obstacle in the middle
    for (let x = 0; x <= 6; x++) {
      for (let z = -2; z <= 2; z++) {
        const isObstacle = x === 3 && Math.abs(z) <= 1
        if (!isObstacle) {
          waterBlocks.add(`${x},-1,${z}`)
        }
      }
    }

    const bot = createMockBot(waterBlocks)
    const start = new Vec3(0.5, -1, 0.5)
    const goal = new Vec3(6.5, -1, 0.5)

    const path = findWaterPath(start, goal, bot, 100)

    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(1)
  })

  it('findWaterPath returns null for impossible path', () => {
    const waterBlocks = new Set<string>()
    // Create two separate islands
    waterBlocks.add('0,-1,0')
    waterBlocks.add('10,-1,0')

    const bot = createMockBot(waterBlocks)
    const start = new Vec3(0.5, -1, 0.5)
    const goal = new Vec3(10.5, -1, 0.5)

    const path = findWaterPath(start, goal, bot, 100)

    expect(path).toBeNull()
  })

  it('findWaterPath respects maxDistance limit', () => {
    const waterBlocks = new Set<string>()
    for (let x = 0; x <= 200; x++) {
      waterBlocks.add(`${x},-1,0`)
    }
    const bot = createMockBot(waterBlocks)
    const start = new Vec3(0.5, -1, 0.5)
    const goal = new Vec3(200.5, -1, 0.5) // 200 blocks away

    const path = findWaterPath(start, goal, bot, 50) // Only search 50 blocks

    expect(path).toBeNull() // Should not find path beyond maxDistance
  })

  it('findWaterPath handles 2D pathfinding correctly', () => {
    const waterBlocks = new Set<string>()
    // Maze with multiple z-values
    for (let x = 0; x <= 4; x++) {
      waterBlocks.add(`${x},-1,0`)
    }
    for (let z = 0; z <= 4; z++) {
      waterBlocks.add(`4,-1,${z}`)
    }
    const bot = createMockBot(waterBlocks)
    const start = new Vec3(0.5, -1, 0.5)
    const goal = new Vec3(4.5, -1, 4.5)

    const path = findWaterPath(start, goal, bot, 100)

    expect(path).not.toBeNull()
    expect(path![path!.length - 1]).toEqual({ x: 4, z: 4 })
  })
})
