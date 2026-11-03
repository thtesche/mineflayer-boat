import type { Bot } from 'mineflayer'
import { Vec3 } from 'vec3'
import { boatFits, isWaterBlock } from './water.js'

/** A waypoint the bot should navigate to (integer block coordinates). */
export interface Waypoint {
  x: number
  z: number
}

/**
 * Find a path from start to goal over water blocks using A* search.
 * Returns waypoints at integer block coordinates, or null if no path exists.
 * Searches within maxDistance blocks horizontally to avoid huge searches.
 */
export function findWaterPath (
  start: Vec3,
  goal: Vec3,
  bot: Bot,
  maxDistance: number = 128
): Waypoint[] | null {
  const startKey = `${Math.floor(start.x)},${Math.floor(start.z)}`
  const goalKey = `${Math.floor(goal.x)},${Math.floor(goal.z)}`

  if (startKey === goalKey) return []

  const openSet = new PriorityQueue<string>()
  const cameFrom = new Map<string, string>()
  const gScore = new Map<string, number>()
  const fScore = new Map<string, number>()

  const heuristic = (x: number, z: number): number => {
    const dx = goal.x - x
    const dz = goal.z - z
    return Math.sqrt(dx * dx + dz * dz)
  }

  gScore.set(startKey, 0)
  fScore.set(startKey, heuristic(Math.floor(start.x), Math.floor(start.z)))
  openSet.add(startKey, fScore.get(startKey)!)

  const neighbors = (x: number, z: number): Array<[number, number]> => [
    [x + 1, z],
    [x - 1, z],
    [x, z + 1],
    [x, z - 1],
    // Diagonals (cost is still 1, not sqrt(2), for simplicity)
    [x + 1, z + 1],
    [x + 1, z - 1],
    [x - 1, z + 1],
    [x - 1, z - 1]
  ]

  const blockLookup = (bx: number, by: number, bz: number) => bot.blockAt(new Vec3(bx, by, bz))

  const isValid = (x: number, z: number): boolean => {
    const dx = Math.abs(x - start.x)
    const dz = Math.abs(z - start.z)
    if (Math.sqrt(dx * dx + dz * dz) > maxDistance) return false

    // Check if block is water and boat fits there
    // Test a few y levels around the water surface
    for (let y = start.y - 2; y <= start.y + 2; y++) {
      const block = bot.blockAt(new Vec3(x + 0.5, y, z + 0.5))
      if (isWaterBlock(block) && boatFits(blockLookup, x + 0.5, z + 0.5, y)) {
        return true
      }
    }
    return false
  }

  while (!openSet.isEmpty()) {
    const current = openSet.shift()!
    const [cx, cz] = current.split(',').map(Number)

    if (current === goalKey) {
      return reconstructPath(cameFrom, current)
    }

    for (const [nx, nz] of neighbors(cx, cz)) {
      if (!isValid(nx, nz)) continue

      const tentativeGScore = (gScore.get(current) ?? Infinity) + 1

      if (tentativeGScore < (gScore.get(`${nx},${nz}`) ?? Infinity)) {
        cameFrom.set(`${nx},${nz}`, current)
        gScore.set(`${nx},${nz}`, tentativeGScore)
        const f = tentativeGScore + heuristic(nx, nz)
        fScore.set(`${nx},${nz}`, f)
        openSet.add(`${nx},${nz}`, f)
      }
    }
  }

  return null
}

function reconstructPath (cameFrom: Map<string, string>, current: string): Waypoint[] {
  const path: Waypoint[] = []
  let c = current
  while (cameFrom.has(c)) {
    const [x, z] = c.split(',').map(Number)
    path.unshift({ x, z })
    c = cameFrom.get(c)!
  }
  const [x, z] = c.split(',').map(Number)
  path.unshift({ x, z })
  return path
}

/** Min-heap priority queue for A* open set. */
class PriorityQueue<T> {
  private items: Array<[T, number]> = []

  add (item: T, priority: number): void {
    this.items.push([item, priority])
    this.items.sort((a, b) => a[1] - b[1])
  }

  shift (): T | undefined {
    return this.items.shift()?.[0]
  }

  isEmpty (): boolean {
    return this.items.length === 0
  }
}
