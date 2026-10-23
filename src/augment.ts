import type { Entity } from 'prismarine-entity'
import type { Boat, BoatOptions } from './boat.js'

declare module 'mineflayer' {
  interface Bot {
    boat: Boat
    /** Maintained by Mineflayer's entities plugin, missing from its typings. */
    vehicle: Entity | null
  }
  interface BotOptions {
    /** Options for mineflayer-boat's `plugin`. */
    boat?: BoatOptions
  }
}
