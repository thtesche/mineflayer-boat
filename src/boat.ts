import type { Bot } from 'mineflayer'
import { Vec3 } from 'vec3'
import './augment.js'
import {
  DEFAULT_KINEMATICS,
  type BoatState,
  type KinematicParams,
  type StepInput,
  horizontalDistance,
  mineflayerYawFromNotchian,
  notchianYawFromMineflayer,
  stepBoat,
  yawToward
} from './kinematics.js'
import { boatFits, isWaterBlock } from './water.js'

type Entity = Bot['entity']
type Item = NonNullable<Bot['heldItem']>

/** Any boat or raft, chest variants included (1.21.2+ names every wood). */
export const BOAT_NAME = /(^|_)(boat|raft)$/

/** Approximate height of the seat above the boat's origin. */
const SEAT_OFFSET = 0.35
const TICK_MS = 50

export interface BoatOptions {
  /** Kinematic model parameters (speeds in blocks/tick). */
  kinematics?: Partial<KinematicParams>
  /** Server corrections in a row (each within 10 ticks of the last) that abort a drive. */
  maxConsecutiveCorrections?: number
}

export interface SignalOptions {
  signal?: AbortSignal
}

export interface DriveOptions extends SignalOptions {
  /** Called once per tick after the step was sent. */
  onTick?: (info: { tick: number, state: BoatState, input: StepInput }) => void
  /** Called for every clientbound `vehicle_move` (server correction). */
  onCorrection?: (info: { tick: number, server: Vec3, predicted: Vec3 }) => void
  /** Give up after this many ticks (default: generous for the distance). */
  maxTicks?: number
}

export interface RecoverOptions extends SignalOptions {
  /** Item to expect back (default: the boat entity's name, e.g. `oak_boat`). */
  itemName?: string
  /** Host pathfinding to the drop and back; without it the bot moves in a straight line. */
  walkTo?: (position: Vec3) => Promise<void>
}

export type DriveStatus = 'arrived' | 'blocked' | 'rejected' | 'aborted' | 'lost' | 'timeout'

export interface DriveResult {
  status: DriveStatus
  /** Ticks spent driving. */
  ticks: number
  /** Horizontal distance covered from start to end position. */
  distance: number
  /** distance / ticks */
  averageSpeed: number
  /** Highest per-tick speed of the simulation. */
  topSpeed: number
  /** Number of clientbound `vehicle_move` corrections received. */
  corrections: number
  /** Real time the drive took, to judge timer drift. */
  elapsedMs: number
  position: Vec3
}

export type TravelStatus = 'success' | 'failed_to_place' | 'failed_to_board' | 'failed_to_drive' | 'failed_to_recover'

export interface TravelResult {
  status: TravelStatus
  boat?: Entity
  driveResult?: DriveResult
  recovered: boolean
  message: string
}

export interface Boat {
  /** Resolved options. */
  readonly options: Required<Pick<BoatOptions, 'maxConsecutiveCorrections'>> & { kinematics: KinematicParams }
  /** The best boat item in the inventory (plain boats before chest boats), or null. */
  findItem: () => Item | null
  /**
   * Places a carried boat on the water at `water` (a point on the water
   * surface within reach) and resolves with the spawned boat entity.
   */
  place: (water: Vec3, options?: SignalOptions & { item?: Item }) => Promise<Entity>
  /** Mounts `boat` and waits until the server confirms it. */
  board: (boat: Entity, options?: SignalOptions) => Promise<void>
  /** Drives the boat being ridden to `target` (x/z) along a straight line. */
  drive: (target: Vec3, options?: DriveOptions) => Promise<DriveResult>
  /** Leaves the boat by sneaking; `faceToward` picks the side vanilla puts the rider on. */
  leave: (options?: SignalOptions & { faceToward?: Vec3 }) => Promise<void>
  /**
   * Breaks an empty boat within reach and picks its item up, swimming to the
   * drop if needed, then returns to where the bot stood. Resolves true when
   * the item is back in the inventory.
   */
  recover: (boat: Entity, options?: RecoverOptions) => Promise<boolean>
  /**
   * Complete boat journey in one call: place → board → drive → leave → recover.
   * Returns result with status (success or which step failed), drive metrics, and recovery status.
   */
  travel: (from: Vec3, to: Vec3, options?: SignalOptions & DriveOptions & RecoverOptions & { faceToward?: Vec3 }) => Promise<TravelResult>
  /** True while riding a boat or raft. */
  isRiding: () => boolean
}

const sleep = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms))

function throwIfAborted (signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new Error('Boat action aborted')
}

async function waitFor (predicate: () => boolean, timeoutMs: number, what: string, signal?: AbortSignal): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    throwIfAborted(signal)
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`)
    await sleep(TICK_MS)
  }
}

function countItem (bot: Bot, name: string): number {
  return bot.inventory.items().filter(i => i.name === name).reduce((n, i) => n + i.count, 0)
}

export function createBoat (bot: Bot, options: BoatOptions = {}): Boat {
  const resolved = {
    kinematics: { ...DEFAULT_KINEMATICS, ...options.kinematics },
    maxConsecutiveCorrections: options.maxConsecutiveCorrections ?? 3
  }
  const client = bot._client

  const isRiding = (): boolean => bot.vehicle != null && BOAT_NAME.test(bot.vehicle.name ?? '')

  function findItem (): Item | null {
    const boats = bot.inventory.items().filter(i => BOAT_NAME.test(i.name))
    return boats.find(i => !i.name.includes('chest')) ?? boats[0] ?? null
  }

  async function place (water: Vec3, opts: SignalOptions & { item?: Item } = {}): Promise<Entity> {
    const item = opts.item ?? findItem()
    if (item == null) throw new Error('no_boat: no boat in the inventory')
    await bot.equip(item, 'hand')
    throwIfAborted(opts.signal)
    // Mineflayer's placeEntity breaks on 1.21.2+ (wrong entity name, and on
    // 4.39.0 a use_item without rotation that disconnects). activateItem sends
    // a complete use_item; the server ray-casts from our look onto the water.
    await bot.lookAt(water, true)
    await sleep(TICK_MS)
    const known = new Set(Object.keys(bot.entities))
    let spawned: Entity | undefined
    const onSpawn = (entity: Entity): void => {
      if (spawned == null && !known.has(String(entity.id)) && BOAT_NAME.test(entity.name ?? '') &&
        horizontalDistance(entity.position, water) < 3) spawned = entity
    }
    bot.on('entitySpawn', onSpawn)
    try {
      bot.activateItem()
      await waitFor(() => spawned != null, 3000, 'the placed boat to spawn', opts.signal)
    } finally {
      bot.removeListener('entitySpawn', onSpawn)
    }
    return spawned as Entity
  }

  async function board (boat: Entity, opts: SignalOptions = {}): Promise<void> {
    if (bot.vehicle === boat) return
    bot.clearControlStates()
    bot.mount(boat)
    await waitFor(() => bot.vehicle === boat, 3000, 'the server to confirm boarding', opts.signal)
  }

  async function drive (target: Vec3, opts: DriveOptions = {}): Promise<DriveResult> {
    const boat = bot.vehicle
    if (boat == null || !isRiding()) throw new Error('not_riding: not in a boat')
    const params = resolved.kinematics
    const start = boat.position.clone()
    // The server stops simulating a boat once a player controls it; hold the
    // height it settled at, which is where vanilla clients float it.
    // A settled boat's origin sits a little below the surface, inside the
    // top water block; a boat lifted by a wave may sit just above it.
    const blockAt = (x: number, y: number, z: number): { name: string, boundingBox: string } | null => bot.blockAt(new Vec3(x, y, z))
    const waterY = isWaterBlock(blockAt(start.x, Math.floor(start.y), start.z)) ? Math.floor(start.y) : Math.floor(start.y) - 1
    let state: BoatState = { x: start.x, y: start.y, z: start.z, yaw: notchianYawFromMineflayer(boat.yaw), speed: 0 }
    const maxTicks = opts.maxTicks ?? Math.ceil(horizontalDistance(start, target) / params.turnSpeed) + 200

    let corrections = 0
    let consecutive = 0
    let lastCorrectionTick = -Infinity
    let tick = 0
    let topSpeed = 0
    let lastInput: StepInput | null = null
    const onCorrection = (packet: { x: number, y: number, z: number, yaw: number }): void => {
      const server = new Vec3(packet.x, packet.y, packet.z)
      opts.onCorrection?.({ tick, server, predicted: new Vec3(state.x, state.y, state.z) })
      corrections++
      consecutive = tick - lastCorrectionTick <= 10 ? consecutive + 1 : 1
      lastCorrectionTick = tick
      state = { x: packet.x, y: packet.y, z: packet.z, yaw: packet.yaw, speed: state.speed / 2 }
    }
    client.on('vehicle_move', onCorrection)

    const startedAt = performance.now()
    let next = startedAt
    let status: DriveStatus = 'timeout'
    try {
      while (tick < maxTicks) {
        if (opts.signal?.aborted === true) { status = 'aborted'; break }
        if (bot.vehicle !== boat || !boat.isValid) { status = 'lost'; break }
        if (consecutive >= resolved.maxConsecutiveCorrections) { status = 'rejected'; break }

        const step = stepBoat(state, target, params)
        if (!boatFits(blockAt, step.state.x, step.state.z, waterY)) { status = 'blocked'; break }
        state = step.state
        topSpeed = Math.max(topSpeed, state.speed)
        sendStep(state, step.input, lastInput)
        lastInput = step.input
        syncEntities(boat, state)
        opts.onTick?.({ tick, state, input: step.input })
        tick++
        if (step.arrived) { status = 'arrived'; break }

        next += TICK_MS
        await sleep(Math.max(0, next - performance.now()))
      }
    } finally {
      client.removeListener('vehicle_move', onCorrection)
      if (bot.vehicle === boat) {
        client.write('steer_boat', { leftPaddle: false, rightPaddle: false })
        client.write('player_input', { inputs: {} })
      }
    }
    const distance = horizontalDistance(start, state)
    return {
      status,
      ticks: tick,
      distance,
      averageSpeed: tick > 0 ? distance / tick : 0,
      topSpeed,
      corrections,
      elapsedMs: performance.now() - startedAt,
      position: new Vec3(state.x, state.y, state.z)
    }
  }

  function sendStep (state: BoatState, input: StepInput, last: StepInput | null): void {
    if (last == null || last.forward !== input.forward || last.backward !== input.backward ||
      last.left !== input.left || last.right !== input.right) {
      client.write('player_input', { inputs: { ...input } })
    }
    // Paddle animation only; vanilla clients send it every tick while riding.
    client.write('steer_boat', { leftPaddle: input.forward || input.right, rightPaddle: input.forward || input.left })
    client.write('vehicle_move', { x: state.x, y: state.y, z: state.z, yaw: state.yaw, pitch: 0, onGround: false })
  }

  function syncEntities (boat: Entity, state: BoatState): void {
    boat.position.set(state.x, state.y, state.z)
    boat.yaw = mineflayerYawFromNotchian(state.yaw)
    // Mineflayer runs no physics while mounted; keep the body where the boat is.
    bot.entity.position.set(state.x, state.y + SEAT_OFFSET, state.z)
    bot.entity.velocity.set(0, 0, 0)
    bot.entity.yaw = boat.yaw
  }

  function setSneak (down: boolean): void {
    client.write('entity_action', { entityId: bot.entity.id, actionId: down ? 'start_sneaking' : 'stop_sneaking', jumpBoost: 0 })
    client.write('player_input', { inputs: down ? { shift: true } : {} })
  }

  async function leave (opts: SignalOptions & { faceToward?: Vec3 } = {}): Promise<void> {
    const boat = bot.vehicle
    if (boat == null) return
    if (opts.faceToward != null) {
      // Vanilla dismounts a boat's rider in the direction the rider faces.
      const yaw = yawToward(boat.position, opts.faceToward)
      client.write('look', { yaw, pitch: 0, flags: { onGround: false, hasHorizontalCollision: false } })
      bot.entity.yaw = mineflayerYawFromNotchian(yaw)
      bot.entity.pitch = 0
      await sleep(TICK_MS)
    }
    // A vehicle is left with sneak; bot.dismount() sends jump on 1.21.2+,
    // which the server ignores (PrismarineJS/mineflayer#4093). A 1.21.4
    // server still takes the sneak flag from entity_action PRESS_SHIFT_KEY
    // and only stores player_input.shift, so send both.
    // Mineflayer misses this dismount on modern versions: its set_passengers
    // handler only looks at passenger lists that contain the bot.
    let left = false
    const onPassengers = (packet: { entityId: number, passengers: number[] }): void => {
      if (packet.entityId === boat.id && !packet.passengers.includes(bot.entity.id)) left = true
    }
    client.on('set_passengers', onPassengers)
    client.write('steer_boat', { leftPaddle: false, rightPaddle: false })
    setSneak(true)
    try {
      await waitFor(() => left || bot.vehicle == null, 2500, 'the server to confirm leaving the boat', opts.signal)
    } finally {
      setSneak(false)
      client.removeListener('set_passengers', onPassengers)
    }
    if (bot.vehicle === boat) {
      bot.vehicle = null
      ;(bot.entity as { vehicle: Entity | null }).vehicle = null
      boat.passengers = (boat.passengers ?? []).filter(p => p !== bot.entity)
      bot.emit('dismount', boat)
    }
    // The server teleports the rider to a dismount spot; Mineflayer resumes
    // its physics on that position packet.
    await new Promise<void>(resolve => {
      const timer = setTimeout(done, 1000)
      function done (): void { clearTimeout(timer); bot.removeListener('forcedMove', done); resolve() }
      bot.once('forcedMove', done)
    })
  }

  async function recover (boat: Entity, opts: RecoverOptions = {}): Promise<boolean> {
    if (boat.passengers != null && boat.passengers.length > 0) throw new Error('boat_occupied: someone is in the boat')
    const itemName = opts.itemName ?? (boat.name ?? 'oak_boat')
    const before = countItem(bot, itemName)
    // A boat breaks when its damage passes 40; a fist hit adds 10 and damage
    // decays 1 per tick, so hit about every 250 ms (full attack cooldown).
    for (let hit = 0; hit < 40 && bot.entities[boat.id] === boat; hit++) {
      throwIfAborted(opts.signal)
      await bot.lookAt(boat.position.offset(0, 0.3, 0), true)
      bot.attack(boat)
      await sleep(250)
    }
    if (bot.entities[boat.id] === boat) throw new Error('boat_unbroken: the boat did not break')
    const breakSpot = boat.position.clone()

    const picked = (): boolean => countItem(bot, itemName) > before
    const shore = bot.entity.position.clone()
    try {
      await waitFor(picked, 1000, 'the boat item', opts.signal)
      return true
    } catch {}

    // The item spawns at the boat with a random kick and, during its pickup
    // delay, usually sinks out of reach of the shore. Go and get it.
    const findDrop = (): Entity | undefined => Object.values(bot.entities).find(e => e.name === 'item' &&
      (e as Entity & { getDroppedItem?: () => Item | null }).getDroppedItem?.()?.name === itemName &&
      e.position.distanceTo(breakSpot) < 6)
    if (opts.walkTo != null) {
      const drop = findDrop()
      if (drop != null) await opts.walkTo(drop.position.clone())
      try { await waitFor(picked, 2000, 'the boat item', opts.signal) } catch {}
      await opts.walkTo(shore)
      return picked()
    }
    await moveStraight(() => picked() ? null : findDrop()?.position ?? null, 10000, opts.signal)
    await moveStraight(() => horizontalDistance(bot.entity.position, shore) < 0.3 && bot.entity.onGround ? null : shore, 6000, opts.signal)
    return picked()
  }

  /**
   * Walks or swims in a straight line toward `goal()` until it returns null or
   * time runs out. Good for the few blocks between a shore and a drop; hosts
   * with a pathfinder pass `walkTo` instead.
   */
  async function moveStraight (goal: () => Vec3 | null, timeoutMs: number, signal?: AbortSignal): Promise<void> {
    const deadline = Date.now() + timeoutMs
    try {
      for (let target = goal(); target != null && Date.now() < deadline; target = goal()) {
        throwIfAborted(signal)
        const body = bot.entity.position
        const distance = horizontalDistance(body, target)
        await bot.look(mineflayerYawFromNotchian(yawToward(body, target)), 0, true)
        const inWater = (bot.entity as Entity & { isInWater?: boolean }).isInWater === true
        bot.setControlState('forward', distance > 0.25)
        // Stay at the surface, but let the body sink onto an item below it.
        bot.setControlState('jump', inWater && !(distance < 0.8 && target.y < body.y - 0.4))
        await sleep(TICK_MS)
      }
    } finally {
      bot.clearControlStates()
    }
  }

  async function travel (from: Vec3, to: Vec3, opts: SignalOptions & DriveOptions & RecoverOptions & { faceToward?: Vec3 } = {}): Promise<TravelResult> {
    try {
      // Step 1: Place boat
      let boat: Entity
      try {
        boat = await place(from, opts)
      } catch (err: any) {
        return {
          status: 'failed_to_place',
          recovered: false,
          message: `Failed to place boat at ${from.toString()}: ${err.message}`
        }
      }

      // Step 2: Board
      try {
        await board(boat, opts)
      } catch (err: any) {
        return {
          status: 'failed_to_board',
          boat,
          recovered: false,
          message: `Failed to board boat: ${err.message}`
        }
      }

      // Step 3: Drive
      let driveResult: DriveResult
      try {
        driveResult = await drive(to, opts)
      } catch (err: any) {
        return {
          status: 'failed_to_drive',
          boat,
          recovered: false,
          message: `Failed to drive to ${to.toString()}: ${err.message}`
        }
      }

      // Step 4: Leave
      try {
        await leave({ signal: opts.signal, faceToward: opts.faceToward })
      } catch (err: any) {
        return {
          status: 'failed_to_drive',
          boat,
          driveResult,
          recovered: false,
          message: `Drove successfully but failed to leave boat: ${err.message}`
        }
      }

      // Step 5: Recover
      let recovered = false
      try {
        recovered = await recover(boat, opts)
      } catch (err: any) {
        // Recovery failed, but drive succeeded
        return {
          status: 'failed_to_recover',
          boat,
          driveResult,
          recovered: false,
          message: `Drove and left boat, but recovery failed: ${err.message}`
        }
      }

      return {
        status: 'success',
        boat,
        driveResult,
        recovered,
        message: `Successfully traveled from ${from.toString()} to ${to.toString()}`
      }
    } catch (err: any) {
      return {
        status: 'failed_to_drive',
        recovered: false,
        message: `Unexpected error during travel: ${err.message}`
      }
    }
  }

  return { options: resolved, findItem, place, board, drive, leave, recover, travel, isRiding }
}
