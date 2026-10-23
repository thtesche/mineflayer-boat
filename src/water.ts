// Water and clearance tests for the boat's box.

/** A boat is 1.375 blocks wide and 0.5625 high. */
export const BOAT_WIDTH = 1.375
export const BOAT_HEIGHT = 0.5625
/** Small margin kept between the boat's box and any bank. */
export const BANK_MARGIN = 0.05

/** The part of a block this module looks at. */
export interface BlockLike {
  name: string
  boundingBox: string
}

export type BlockLookup = (x: number, y: number, z: number) => BlockLike | null

// Water and the always-waterlogged plants a boat floats over. Bubble columns
// are left out on purpose: they pull a boat under or throw it up.
const WATER = new Set(['water', 'seagrass', 'tall_seagrass', 'kelp', 'kelp_plant'])

export function isWaterBlock (block: BlockLike | null): boolean {
  return block != null && WATER.has(block.name)
}

export function isOpenAbove (block: BlockLike | null): boolean {
  return block != null && block.boundingBox === 'empty' && !isWaterBlock(block)
}

/**
 * True when a boat centred at (x, z) floats on water in layer `waterY` with
 * its whole box over water and room above it. Unknown (unloaded) blocks fail.
 */
export function boatFits (blockAt: BlockLookup, x: number, z: number, waterY: number): boolean {
  const half = BOAT_WIDTH / 2 + BANK_MARGIN
  for (let bx = Math.floor(x - half); bx <= Math.floor(x + half); bx++) {
    for (let bz = Math.floor(z - half); bz <= Math.floor(z + half); bz++) {
      if (!isWaterBlock(blockAt(bx, waterY, bz))) return false
      if (!isOpenAbove(blockAt(bx, waterY + 1, bz))) return false
    }
  }
  return true
}
