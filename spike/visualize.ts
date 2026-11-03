// Collect bot position history during a drive and save as JSON for visualization
import { defaultConfig, defaultArena, connectBot, resetArena } from '../test/integration/setup.js'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const cfg = { ...defaultConfig, username: 'BoatyViz' }
  const bot: any = await connectBot(cfg)
  
  await resetArena(bot, cfg, defaultArena)
  
  const history: any[] = []
  
  const boat = await bot.boat.place(defaultArena.launch)
  await bot.waitForTicks(10)
  console.log(`[placed] boat at (${boat.position.x.toFixed(1)}, ${boat.position.z.toFixed(1)})`)
  
  await bot.boat.board(boat)
  await sleep(100)
  console.log(`[boarded] at (${bot.entity.position.x.toFixed(1)}, ${bot.entity.position.z.toFixed(1)})`)
  
  // Record position during drive (every 50ms)
  const recordInterval = setInterval(() => {
    if (bot.vehicle != null && bot.vehicle.id != null) {
      history.push({
        x: bot.entity.position.x,
        z: bot.entity.position.z,
        boatX: bot.vehicle.position.x,
        boatZ: bot.vehicle.position.z,
      })
    }
  }, 50)
  
  const result = await bot.boat.drive(defaultArena.finish)
  clearInterval(recordInterval)
  console.log(`[drive] status=${result.status} distance=${result.distance.toFixed(1)} ticks=${result.ticks}`)
  console.log(`[end] bot at (${bot.entity.position.x.toFixed(1)}, ${bot.entity.position.z.toFixed(1)}), boat at (${boat.position.x.toFixed(1)}, ${boat.position.z.toFixed(1)})`)
  
  await bot.boat.leave({ faceToward: defaultArena.farShore })
  console.log(`[left] final pos (${bot.entity.position.x.toFixed(1)}, ${bot.entity.position.z.toFixed(1)})`)
  
  bot.end()
  
  console.log(`\n[history] ${history.length} frames collected`)
  const out = { arena: defaultArena, history, finalResult: result }
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
