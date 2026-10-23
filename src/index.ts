import type { Bot, BotOptions } from 'mineflayer'
import './augment.js'
import { type BoatOptions, createBoat } from './boat.js'

export * from './boat.js'
export * from './kinematics.js'
export * from './water.js'

/**
 * Mineflayer plugin: `bot.loadPlugin(plugin)` installs `bot.boat`. Mineflayer
 * hands plugins the bot's `createBot` options, so options can be given there
 * as `createBot({ ..., boat: { ... } })`, or baked in with `boatPlugin(...)`.
 */
export function plugin (bot: Bot, options?: BotOptions): void {
  bot.boat = createBoat(bot, options?.boat ?? {})
}

/** Returns a plugin with the given options baked in. */
export function boatPlugin (options: BoatOptions = {}): (bot: Bot) => void {
  return (bot: Bot) => { bot.boat = createBoat(bot, options) }
}

export default plugin
