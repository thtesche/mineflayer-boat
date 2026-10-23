import { describe, expect, it } from 'vitest'
import { type BlockLike, boatFits } from '../src/water.js'

const water: BlockLike = { name: 'water', boundingBox: 'empty' }
const air: BlockLike = { name: 'air', boundingBox: 'empty' }
const grass: BlockLike = { name: 'grass_block', boundingBox: 'block' }

// A channel of water at y = 10, cells x 0..9 and z -2..2, grass elsewhere.
function channel (x: number, y: number, z: number): BlockLike | null {
  if (x < -5 || x > 15) return null // not loaded
  const inChannel = x >= 0 && x <= 9 && z >= -2 && z <= 2
  if (y === 10) return inChannel ? water : grass
  if (y === 11) return air
  return grass
}

describe('boatFits', () => {
  it('accepts the middle of a 5-wide channel', () => {
    expect(boatFits(channel, 5, 0.5, 10)).toBe(true)
  })

  it('refuses a box that overlaps the bank', () => {
    expect(boatFits(channel, 5, 2.5, 10)).toBe(false)
    expect(boatFits(channel, 0.5, 0.5, 10)).toBe(false)
  })

  it('refuses a one-wide river', () => {
    const river = (x: number, y: number, z: number): BlockLike | null =>
      y === 10 ? (z === 0 ? water : grass) : y === 11 ? air : grass
    expect(boatFits(river, 5, 0.5, 10)).toBe(false)
  })

  it('refuses unloaded blocks', () => {
    expect(boatFits(channel, 20, 0.5, 10)).toBe(false)
  })

  it('refuses a low ceiling', () => {
    const bridged = (x: number, y: number, z: number): BlockLike | null =>
      y === 11 && x === 5 ? grass : channel(x, y, z)
    expect(boatFits(bridged, 5, 0.5, 10)).toBe(false)
  })
})
