// Go/no-go spike: place a boat, board it, drive a straight line of ~57 blocks
// over still water, land on the far shore, break the boat and pick it up.
//
// Runs only against the throwaway test server from spike/server (vanilla
// 1.21.4, offline mode, port 25599). It builds its own water channel through
// that server's console (spike/server/run/console.in), so no op is needed.
//
//   npm run server:setup && bash spike/server/start.sh   # other terminal
//   npm run spike
import { appendFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import mineflayer from 'mineflayer'
import { Vec3 } from 'vec3'
import { boatPlugin, type DriveResult } from '../src/index.js'

const HOST = process.env.MC_HOST ?? '127.0.0.1'
const PORT = Number(process.env.MC_PORT ?? 25599)
const USERNAME = process.env.MC_USERNAME ?? 'Boaty'
// When MC_DOCKER names a running container, commands go to its console via
// `docker exec`; otherwise they append to a local console.in FIFO.
const DOCKER = process.env.MC_DOCKER ?? ''
const CONSOLE = process.env.SPIKE_CONSOLE ?? fileURLToPath(new URL('./server/run/console.in', import.meta.url))

if (PORT === 25565) {
  console.error('Refusing port 25565: that is the default LAN/run world port. Use the throwaway test server.')
  process.exit(2)
}
if (DOCKER === '' && !existsSync(CONSOLE)) {
  console.error(`No server console at ${CONSOLE}; start the test server with spike/server/start.sh`)
  process.exit(2)
}

// Superflat: bedrock -64, dirt -63..-62, grass -61, so the ground is y = -60.
// Channel: x 0..59, z -2..2, water y -63..-61. Start shore at x < 0, far
// shore at x >= 60. The boat runs along z = 0.5.
const LANE_Z = 0.5
const START = new Vec3(-0.5, -60, LANE_Z)
const LAUNCH = new Vec3(1.8, -60.1, LANE_Z)
const FINISH = new Vec3(59.0, 0, LANE_Z)
const FAR_SHORE = new Vec3(61, -60, LANE_Z)

const sleep = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms))
const consoleCommand = (cmd: string): void => {
  if (DOCKER !== '') {
    execFileSync('docker', ['exec', '-i', DOCKER, 'sh', '-c', 'cat >> /server/console.in'], { input: cmd + '\n' })
  } else {
    appendFileSync(CONSOLE, cmd + '\n')
  }
}
const fmt = (v: { x: number, y: number, z: number }): string => `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`

const bot = mineflayer.createBot({ host: HOST, port: PORT, username: USERNAME, version: '1.21.4', auth: 'offline' })
const CRUISE = Number(process.env.SPIKE_CRUISE ?? 0.3)
bot.loadPlugin(boatPlugin({ kinematics: { cruiseSpeed: CRUISE } }))

let kicked: string | null = null
bot.on('kicked', reason => { kicked = typeof reason === 'string' ? reason : JSON.stringify(reason) })
bot.on('error', err => console.error('bot error:', err))
if (process.env.SPIKE_DEBUG != null) {
  for (const name of ['set_passengers', 'position', 'vehicle_move', 'attach_entity']) {
    bot._client.on(name, (packet: unknown) => { console.log(`  [packet ${name}] ${JSON.stringify(packet)}`) })
  }
  bot._client.on('entity_metadata', (packet: { entityId: number }) => {
    if (packet.entityId === bot.entity?.id) console.log(`  [packet entity_metadata self] ${JSON.stringify(packet)}`)
  })
  const write = bot._client.write.bind(bot._client)
  bot._client.write = (name: string, params: any) => {
    if (name === 'player_input' || name === 'look') console.log(`  [send ${name}] ${JSON.stringify(params)}`)
    return write(name, params)
  }
}

async function buildArena (): Promise<void> {
  for (const cmd of [
    'gamerule doDaylightCycle false', 'gamerule doMobSpawning false', 'gamerule doWeatherCycle false',
    'time set day', 'weather clear', 'difficulty peaceful',
    'kill @e[type=!minecraft:player]',
    'fill -6 -60 -6 66 -50 6 air',
    'fill -6 -63 -6 66 -61 6 grass_block',
    'fill 0 -63 -2 59 -61 2 water',
    `clear ${USERNAME}`,
    `gamemode survival ${USERNAME}`,
    `give ${USERNAME} oak_boat 1`,
    `tp ${USERNAME} ${START.x} ${START.y} ${START.z} -90 30`
  ]) consoleCommand(cmd)
  // Wait until the teleport arrived and the water chunk is loaded.
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    const water = bot.blockAt(new Vec3(30, -61, 0))
    if (bot.entity.position.distanceTo(START) < 0.6 && water?.name === 'water' && bot.boat.findItem() != null) return
    await sleep(100)
  }
  throw new Error(`arena not ready: at ${fmt(bot.entity.position)}, block ${bot.blockAt(new Vec3(30, -61, 0))?.name}, boat ${bot.boat.findItem()?.name}`)
}

async function run (): Promise<void> {
  await buildArena()
  await bot.waitForTicks(10)
  console.log(`start on shore at ${fmt(bot.entity.position)} holding ${bot.boat.findItem()?.name}`)

  const boat = await bot.boat.place(LAUNCH)
  console.log(`placed ${boat.name} #${boat.id} at ${fmt(boat.position)}`)
  await bot.waitForTicks(20) // let the server settle the boat on the surface
  console.log(`boat settled at ${fmt(boat.position)}`)

  await bot.boat.board(boat)
  console.log(`boarded; bot.vehicle = ${bot.vehicle?.name}`)

  const correctionsLog: string[] = []
  let cruiseTicks = 0
  let cruiseDistance = 0
  const result: DriveResult = await bot.boat.drive(FINISH, {
    onTick: ({ tick, state }) => {
      if (state.speed >= bot.boat.options.kinematics.cruiseSpeed - 1e-9) { cruiseTicks++; cruiseDistance += state.speed }
      if (tick % 40 === 0) console.log(`  tick ${tick}: ${fmt(state)} speed ${state.speed.toFixed(3)} body ${fmt(bot.entity.position)}`)
    },
    onCorrection: ({ tick, server, predicted }) => {
      correctionsLog.push(`tick ${tick}: server ${fmt(server)} vs predicted ${fmt(predicted)}`)
    }
  })
  console.log(`drive: ${result.status} after ${result.ticks} ticks (${(result.elapsedMs / 1000).toFixed(2)} s), ` +
    `${result.distance.toFixed(2)} blocks, avg ${result.averageSpeed.toFixed(3)} b/t, top ${result.topSpeed.toFixed(3)} b/t, ` +
    `cruise ${cruiseTicks > 0 ? (cruiseDistance / cruiseTicks).toFixed(3) : '-'} b/t over ${cruiseTicks} ticks, corrections ${result.corrections}`)
  for (const line of correctionsLog) console.log('  correction ' + line)

  await sleep(250) // no physicsTick while mounted, so no waitForTicks here
  await bot.boat.leave({ faceToward: FAR_SHORE })
  await bot.waitForTicks(10)
  console.log(`left the boat; body at ${fmt(bot.entity.position)} onGround=${bot.entity.onGround}`)

  const brokenAt = boat.position.clone()
  const recovered = await bot.boat.recover(boat, { itemName: 'oak_boat' })
  if (!recovered) {
    const drops = Object.values(bot.entities).filter(e => e.name === 'item').map(e => fmt(e.position))
    console.log(`boat broke at ${fmt(brokenAt)}; item entities now: ${drops.join(' ') || 'none'}`)
  }
  await bot.waitForTicks(10)
  const pos = bot.entity.position
  const ground = bot.blockAt(pos.offset(0, -0.5, 0))
  const boatItems = bot.inventory.items().filter(i => i.name === 'oak_boat').reduce((n, i) => n + i.count, 0)
  console.log(`recovered=${recovered}; body at ${fmt(pos)} on ${ground?.name}; oak_boat in inventory: ${boatItems}`)

  const crossed = result.status === 'arrived' && result.distance >= 50
  const fastEnough = result.averageSpeed >= 0.25
  const fewCorrections = result.corrections <= 2
  const onFarShore = pos.x >= 60 && ground?.name !== 'water' && ground?.boundingBox === 'block'
  const verdict = crossed && fastEnough && fewCorrections && kicked == null && onFarShore && boatItems >= 1
  console.log(JSON.stringify({
    verdict: verdict ? 'GO' : 'NO-GO',
    crossed,
    fastEnough,
    averageSpeed: Number(result.averageSpeed.toFixed(4)),
    corrections: result.corrections,
    kicked,
    onFarShore,
    boatItemBack: boatItems >= 1
  }))
}

bot.once('spawn', () => {
  run()
    .catch(err => { console.error('spike failed:', err); process.exitCode = 1 })
    .finally(() => { setTimeout(() => bot.quit(), 500) })
})
bot.on('end', reason => { console.log(`disconnected: ${reason}${kicked != null ? ` (kicked: ${kicked})` : ''}`) })
