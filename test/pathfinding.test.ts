import { describe, it, expect } from 'vitest'
import { findWaterPath, simplifyPath } from '../src/pathfinding.js'
import { Vec3 } from 'vec3'
import type { Bot } from 'mineflayer'

/**
 * Mock bot backed by a set of water-block keys at y=-1.
 *
 * The boat is 1.375 blocks wide, so `boatFits()` needs water in the whole
 * 3x3 block neighbourhood around a cell centre (x+0.5, z+0.5). Water bodies
 * in these tests are therefore filled as rectangles at least 3 blocks wide,
 * not 1-block lanes.
 */
function createMockBot (waterBlocks: Set<string>): Bot {
  return {
    blockAt: (pos: Vec3) => {
      const key = `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`
      if (waterBlocks.has(key)) {
        return { name: 'water', boundingBox: 'empty' }
      }
      // Open air above the water surface; solid stone below/around.
      if (Math.floor(pos.y) > -1) {
        return { name: 'air', boundingBox: 'empty' }
      }
      return { name: 'stone', boundingBox: 'block' }
    }
  } as unknown as Bot
}

/** Fill a rectangle of water at y=-1 (inclusive bounds). */
function fillWater (
  water: Set<string>,
  x0: number, x1: number,
  z0: number, z1: number
): void {
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      water.add(`${x},-1,${z}`)
    }
  }
}

/** Remove a rectangle of water (carve an obstacle). */
function carveLand (
  water: Set<string>,
  x0: number, x1: number,
  z0: number, z1: number
): void {
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      water.delete(`${x},-1,${z}`)
    }
  }
}

describe('Pathfinding', () => {
  it('mock bot returns water, air, and land correctly', () => {
    const water = new Set<string>()
    fillWater(water, 0, 5, -1, 1)
    const bot = createMockBot(water)

    expect(bot.blockAt(new Vec3(0, -1, 0))?.name).toBe('water')
    expect(bot.blockAt(new Vec3(0, 0, 0))?.name).toBe('air')
    expect(bot.blockAt(new Vec3(0, -2, 0))?.name).toBe('stone')
  })

  it('returns empty path for same start and goal', () => {
    const water = new Set<string>()
    fillWater(water, -1, 1, -1, 1)
    const bot = createMockBot(water)
    const start = new Vec3(0.5, -1, 0.5)
    const goal = new Vec3(0.5, -1, 0.5)

    expect(findWaterPath(start, goal, bot)).toEqual([])
  })

  it('finds a direct path on open water', () => {
    const water = new Set<string>()
    // Wide channel so the boat fits anywhere along z=0.
    fillWater(water, -1, 6, -1, 1)
    const bot = createMockBot(water)
    const start = new Vec3(0.5, -1, 0.5)
    const goal = new Vec3(5.5, -1, 0.5)

    const path = findWaterPath(start, goal, bot, 100)

    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(0)
    expect(path![0]).toEqual({ x: 0, z: 0 })
    expect(path![path!.length - 1]).toEqual({ x: 5, z: 0 })
  })

  it('navigates around an obstacle wall', () => {
    const water = new Set<string>()
    // Open basin, then a wall at x=3 blocking the bottom, forcing a detour up.
    fillWater(water, -1, 7, -1, 5)
    carveLand(water, 3, 3, -1, 2)
    const bot = createMockBot(water)
    const start = new Vec3(0.5, -1, 0.5)
    const goal = new Vec3(6.5, -1, 0.5)

    const path = findWaterPath(start, goal, bot, 100)

    expect(path).not.toBeNull()
    expect(path![0]).toEqual({ x: 0, z: 0 })
    expect(path![path!.length - 1]).toEqual({ x: 6, z: 0 })
    // A straight line would stay at z=0; the detour must climb above the wall.
    const maxZ = Math.max(...path!.map(p => p.z))
    expect(maxZ).toBeGreaterThanOrEqual(3)
  })

  it('returns null when the goal is on a separate water body', () => {
    const water = new Set<string>()
    fillWater(water, -1, 1, -1, 1) // island A around (0,0)
    fillWater(water, 9, 11, -1, 1) // island B around (10,0)
    const bot = createMockBot(water)
    const start = new Vec3(0.5, -1, 0.5)
    const goal = new Vec3(10.5, -1, 0.5)

    expect(findWaterPath(start, goal, bot, 100)).toBeNull()
  })

  it('returns null when the goal is beyond maxDistance', () => {
    const water = new Set<string>()
    fillWater(water, -1, 101, -1, 1) // long reachable channel
    const bot = createMockBot(water)
    const start = new Vec3(0.5, -1, 0.5)
    const goal = new Vec3(100.5, -1, 0.5)

    // Search radius far short of the goal.
    expect(findWaterPath(start, goal, bot, 30)).toBeNull()
  })

  it('follows an L-shaped channel with a turn', () => {
    const water = new Set<string>()
    fillWater(water, -1, 6, -1, 1) // horizontal arm
    fillWater(water, 4, 6, -1, 6) // vertical arm (overlaps corner)
    const bot = createMockBot(water)
    const start = new Vec3(0.5, -1, 0.5)
    const goal = new Vec3(5.5, -1, 5.5)

    const path = findWaterPath(start, goal, bot, 100)

    expect(path).not.toBeNull()
    expect(path![0]).toEqual({ x: 0, z: 0 })
    expect(path![path!.length - 1]).toEqual({ x: 5, z: 5 })
  })
})

describe('simplifyPath', () => {
  it('returns short paths unchanged', () => {
    expect(simplifyPath([])).toEqual([])
    expect(simplifyPath([{ x: 0, z: 0 }])).toEqual([{ x: 0, z: 0 }])
    expect(simplifyPath([{ x: 0, z: 0 }, { x: 1, z: 0 }])).toEqual([
      { x: 0, z: 0 }, { x: 1, z: 0 }
    ])
  })

  it('collapses a straight run to its endpoints', () => {
    const path = [
      { x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }, { x: 3, z: 0 }, { x: 4, z: 0 }
    ]
    expect(simplifyPath(path)).toEqual([{ x: 0, z: 0 }, { x: 4, z: 0 }])
  })

  it('keeps the turning point of an L-shape', () => {
    const path = [
      { x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }, // east
      { x: 2, z: 1 }, { x: 2, z: 2 } // then north
    ]
    expect(simplifyPath(path)).toEqual([
      { x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }
    ])
  })

  it('keeps every corner of a staircase', () => {
    const path = [
      { x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }, { x: 2, z: 1 }, { x: 2, z: 2 }
    ]
    expect(simplifyPath(path)).toEqual([
      { x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }, { x: 2, z: 1 }, { x: 2, z: 2 }
    ])
  })
})
