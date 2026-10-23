// Client-side boat kinematics.
//
// A boat ridden by a player is simulated by that player's client, which
// reports the result to the server with `vehicle_move` every tick. Mineflayer
// has no boat physics, so this module provides a small kinematic model whose
// positions the server accepts. It is deliberately simpler than vanilla
// (`AbstractBoat.controlBoat`/`floatBoat`): speed ramps to a cruising speed,
// yaw turns toward the target at a bounded rate, the boat moves along its yaw
// and `y` is held constant (the caller keeps it at the water surface).
//
// Yaw is in Minecraft (notchian) degrees: 0 faces +z (south), 90 faces -x
// (west), -90 faces +x (east). A boat moving forward goes
// (-sin(yaw), 0, cos(yaw)), exactly like vanilla.

/** Simulated boat state, one per tick. */
export interface BoatState {
  x: number
  y: number
  z: number
  /** Notchian yaw in degrees. */
  yaw: number
  /** Horizontal speed in blocks per tick (never negative). */
  speed: number
}

export interface KinematicParams {
  /** Cruising speed in blocks/tick. Vanilla terminal speed on water is ~0.36–0.4. */
  cruiseSpeed: number
  /** Speed gained per tick while paddling (vanilla thrust: 0.04). */
  acceleration: number
  /** Speed lost per tick while braking. */
  deceleration: number
  /** Largest yaw change per tick, in degrees. */
  maxTurnRate: number
  /** Above this heading error (degrees) the boat slows to `turnSpeed`. */
  turnSlowdownAngle: number
  /** Speed cap while turning sharply. */
  turnSpeed: number
  /** Distance at which the target counts as reached. */
  arriveDistance: number
}

export const DEFAULT_KINEMATICS: Readonly<KinematicParams> = Object.freeze({
  cruiseSpeed: 0.3,
  acceleration: 0.04,
  deceleration: 0.04,
  maxTurnRate: 6,
  turnSlowdownAngle: 30,
  turnSpeed: 0.1,
  arriveDistance: 0.05
})

/** Inputs a vanilla client would show for this step (paddles, player_input). */
export interface StepInput {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
}

export interface StepResult {
  state: BoatState
  input: StepInput
  arrived: boolean
}

/** Wraps an angle in degrees into [-180, 180). */
export function wrapDegrees (angle: number): number {
  const a = ((angle + 180) % 360 + 360) % 360
  return a - 180
}

/** Notchian yaw (degrees) that faces from `from` toward `to` in the x/z plane. */
export function yawToward (from: { x: number, z: number }, to: { x: number, z: number }): number {
  return Math.atan2(-(to.x - from.x), to.z - from.z) * 180 / Math.PI
}

/** Converts Mineflayer's entity yaw (radians, its own convention) to notchian degrees. */
export function notchianYawFromMineflayer (yaw: number): number {
  return wrapDegrees((Math.PI - yaw) * 180 / Math.PI)
}

/** Converts notchian degrees to Mineflayer's entity yaw (radians). */
export function mineflayerYawFromNotchian (yaw: number): number {
  return Math.PI - yaw * Math.PI / 180
}

export function horizontalDistance (a: { x: number, z: number }, b: { x: number, z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/**
 * Advances the boat one tick toward `target` (x/z only). Pure: the caller
 * checks the returned position for collisions before sending it.
 */
export function stepBoat (state: BoatState, target: { x: number, z: number }, params: KinematicParams = DEFAULT_KINEMATICS): StepResult {
  const remaining = horizontalDistance(state, target)
  if (remaining <= params.arriveDistance) {
    return { state: { ...state, speed: 0 }, input: { forward: false, backward: false, left: false, right: false }, arrived: true }
  }

  const error = wrapDegrees(yawToward(state, target) - state.yaw)
  const turn = Math.max(-params.maxTurnRate, Math.min(params.maxTurnRate, error))
  const yaw = wrapDegrees(state.yaw + turn)

  // Brake so the boat stops on the target: v² / 2a plus one tick of slack.
  const brakingDistance = state.speed * state.speed / (2 * params.deceleration) + state.speed
  const braking = remaining <= brakingDistance
  let speed = braking
    ? Math.max(params.deceleration, state.speed - params.deceleration)
    : Math.min(params.cruiseSpeed, state.speed + params.acceleration)
  if (Math.abs(error) > params.turnSlowdownAngle) speed = Math.min(speed, params.turnSpeed)

  const step = Math.min(speed, remaining)
  const rad = yaw * Math.PI / 180
  const x = state.x - Math.sin(rad) * step
  const z = state.z + Math.cos(rad) * step
  const arrived = horizontalDistance({ x, z }, target) <= params.arriveDistance

  return {
    state: { x, y: state.y, z, yaw, speed: arrived ? 0 : speed },
    input: { forward: !braking, backward: braking, left: turn < -0.5, right: turn > 0.5 },
    arrived
  }
}
