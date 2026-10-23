import { describe, expect, it } from 'vitest'
import {
  DEFAULT_KINEMATICS,
  type BoatState,
  horizontalDistance,
  mineflayerYawFromNotchian,
  notchianYawFromMineflayer,
  stepBoat,
  wrapDegrees,
  yawToward
} from '../src/kinematics.js'

function run (state: BoatState, target: { x: number, z: number }, maxTicks = 2000): { state: BoatState, ticks: number, arrived: boolean } {
  let ticks = 0
  for (; ticks < maxTicks; ticks++) {
    const step = stepBoat(state, target)
    state = step.state
    if (step.arrived) return { state, ticks: ticks + 1, arrived: true }
  }
  return { state, ticks, arrived: false }
}

describe('angles', () => {
  it('wraps degrees into [-180, 180)', () => {
    expect(wrapDegrees(190)).toBe(-170)
    expect(wrapDegrees(-190)).toBe(170)
    expect(wrapDegrees(720)).toBe(0)
  })

  it('uses notchian yaw: 0 = +z, -90 = +x, 90 = -x', () => {
    expect(yawToward({ x: 0, z: 0 }, { x: 0, z: 5 })).toBeCloseTo(0)
    expect(yawToward({ x: 0, z: 0 }, { x: 5, z: 0 })).toBeCloseTo(-90)
    expect(yawToward({ x: 0, z: 0 }, { x: -5, z: 0 })).toBeCloseTo(90)
  })

  it('converts between mineflayer and notchian yaw', () => {
    for (const yaw of [-170, -90, 0, 45, 90, 179]) {
      expect(notchianYawFromMineflayer(mineflayerYawFromNotchian(yaw))).toBeCloseTo(yaw)
    }
  })
})

describe('stepBoat', () => {
  it('moves along its yaw like vanilla (-sin, cos)', () => {
    const { state } = stepBoat({ x: 0, y: 0, z: 0, yaw: -90, speed: 0.2 }, { x: 50, z: 0 })
    expect(state.x).toBeGreaterThan(0)
    expect(state.z).toBeCloseTo(0)
  })

  it('ramps up to cruising speed and never exceeds it', () => {
    let state: BoatState = { x: 0, y: 64, z: 0, yaw: -90, speed: 0 }
    let top = 0
    for (let i = 0; i < 30; i++) {
      state = stepBoat(state, { x: 100, z: 0 }).state
      top = Math.max(top, state.speed)
    }
    expect(top).toBeCloseTo(DEFAULT_KINEMATICS.cruiseSpeed)
    expect(state.y).toBe(64)
  })

  it('crosses 50 blocks straight at >= 0.25 blocks/tick and stops on the target', () => {
    const start: BoatState = { x: 0, y: 0, z: 0, yaw: -90, speed: 0 }
    const target = { x: 50, z: 0 }
    const { state, ticks, arrived } = run(start, target)
    expect(arrived).toBe(true)
    expect(horizontalDistance(state, target)).toBeLessThanOrEqual(DEFAULT_KINEMATICS.arriveDistance)
    expect(50 / ticks).toBeGreaterThanOrEqual(0.25)
  })

  it('turns at a bounded rate and slows down for sharp turns', () => {
    const { state } = stepBoat({ x: 0, y: 0, z: 0, yaw: 0, speed: 0.3 }, { x: 0, z: -20 })
    expect(Math.abs(wrapDegrees(state.yaw))).toBeCloseTo(DEFAULT_KINEMATICS.maxTurnRate)
    expect(state.speed).toBeLessThanOrEqual(DEFAULT_KINEMATICS.turnSpeed)
  })

  it('reaches a target behind it', () => {
    const { arrived } = run({ x: 0, y: 0, z: 0, yaw: 0, speed: 0 }, { x: 3, z: -10 })
    expect(arrived).toBe(true)
  })

  it('never steps more than the cruising speed', () => {
    let state: BoatState = { x: 0, y: 0, z: 0, yaw: 45, speed: 0 }
    for (let i = 0; i < 300; i++) {
      const next = stepBoat(state, { x: 20, z: 30 }).state
      expect(horizontalDistance(state, next)).toBeLessThanOrEqual(DEFAULT_KINEMATICS.cruiseSpeed + 1e-9)
      state = next
    }
  })
})
