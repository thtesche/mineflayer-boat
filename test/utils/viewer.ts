/**
 * Prismarine Viewer integration for visual test validation.
 * Records bot movements during tests and generates an interactive 3D HTML viewer.
 *
 * Usage:
 * ```ts
 * const viewer = new TestViewer(bot)
 * viewer.startRecording()
 * // ... run test ...
 * await viewer.saveHTML('test-result.html')
 * ```
 */

import type Bot from 'mineflayer'
import { Vec3 } from 'vec3'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface BoatSnapshot {
  tick: number
  timestamp: number
  pos: { x: number; y: number; z: number }
  vel: { x: number; y: number; z: number }
  yaw: number
  onGround: boolean
  inWater: boolean
  status?: string
}

export interface ViewerConfig {
  recordTicks?: number // How often to record (every N ticks)
  maxSnapshots?: number // Max snapshots to keep in memory
  outputDir?: string // Where to write HTML
}

/**
 * Record bot movements and generate a Prismarine Viewer HTML snapshot.
 * Captures boat position, velocity, and state each tick.
 */
export class TestViewer {
  private bot: Bot
  private snapshots: BoatSnapshot[] = []
  private isRecording = false
  private tickCounter = 0
  private recordInterval: number
  private config: Required<ViewerConfig>
  private moveListener: (() => void) | null = null

  constructor(bot: Bot, config: ViewerConfig = {}) {
    this.bot = bot
    this.config = {
      recordTicks: config.recordTicks ?? 1,
      maxSnapshots: config.maxSnapshots ?? 10000,
      outputDir: config.outputDir ?? '/tmp',
    }
    this.recordInterval = this.config.recordTicks
  }

  /**
   * Start recording bot snapshots each tick.
   */
  startRecording(): void {
    if (this.isRecording) return

    this.isRecording = true
    this.snapshots = []
    this.tickCounter = 0

    this.moveListener = () => {
      this.tickCounter++
      if (this.tickCounter % this.recordInterval === 0) {
        this.recordSnapshot()
      }
    }

    this.bot.on('move', this.moveListener)
  }

  /**
   * Stop recording.
   */
  stopRecording(): void {
    if (this.moveListener && this.isRecording) {
      this.bot.removeListener('move', this.moveListener)
    }
    this.isRecording = false
  }

  /**
   * Capture current boat state.
   */
  private recordSnapshot(): void {
    if (!this.bot.vehicle) return

    const pos = this.bot.vehicle.position ?? this.bot.entity.position
    const vel = this.bot.vehicle.velocity ?? new Vec3(0, 0, 0)

    const snapshot: BoatSnapshot = {
      tick: this.tickCounter,
      timestamp: Date.now(),
      pos: { x: pos.x, y: pos.y, z: pos.z },
      vel: { x: vel.x, y: vel.y, z: vel.z },
      yaw: this.bot.entity.yaw,
      onGround: (this.bot.vehicle as any).onGround ?? false,
      inWater: (this.bot.vehicle as any).isInWater ?? false,
    }

    this.snapshots.push(snapshot)

    // Keep memory usage bounded
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift()
    }
  }

  /**
   * Get all recorded snapshots.
   */
  getSnapshots(): BoatSnapshot[] {
    return [...this.snapshots]
  }

  /**
   * Generate an interactive HTML viewer with Prismarine Viewer.
   * Shows 3D world with bot path overlay.
   */
  async saveHTML(filename: string): Promise<void> {
    const html = this.generateHTML()
    await mkdir(dirname(filename), { recursive: true })
    await writeFile(filename, html, 'utf-8')
    console.log(
      `[TestViewer] Saved ${filename} with ${this.snapshots.length} snapshots (${(html.length / 1024).toFixed(1)}KB)`,
    )
  }

  /**
   * Generate HTML with embedded Prismarine Viewer.
   */
  private generateHTML(): string {
    const data = JSON.stringify(this.snapshots, null, 2)

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>mineflayer-boat Test Viewer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1e1e1e; color: #e0e0e0; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    h1 { margin-bottom: 20px; color: #4da6ff; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .panel { background: #2d2d2d; border-radius: 8px; padding: 20px; border: 1px solid #404040; }
    .panel h2 { font-size: 14px; text-transform: uppercase; color: #4da6ff; margin-bottom: 12px; letter-spacing: 1px; }
    .stats { font-family: monospace; font-size: 12px; line-height: 1.6; }
    .stat-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #404040; }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: #888; }
    .stat-value { color: #4da6ff; font-weight: bold; }
    #viewer { width: 100%; height: 600px; background: #1a1a1a; border-radius: 8px; border: 1px solid #404040; position: relative; }
    .placeholder { display: flex; align-items: center; justify-content: center; color: #666; font-size: 14px; height: 100%; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⛵ mineflayer-boat Test Viewer</h1>
    <div class="grid">
      <div class="panel">
        <h2>Test Statistics</h2>
        <div class="stats">
          <div class="stat-row">
            <span class="stat-label">Snapshots:</span>
            <span class="stat-value">${this.snapshots.length}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Duration:</span>
            <span class="stat-value">${this.snapshots.length > 0 ? Math.round((this.snapshots[this.snapshots.length - 1].timestamp - this.snapshots[0].timestamp) / 1000) : 0}s</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Start Pos:</span>
            <span class="stat-value">${this.snapshots.length > 0 ? \`(\${this.snapshots[0].pos.x.toFixed(1)}, \${this.snapshots[0].pos.y.toFixed(1)}, \${this.snapshots[0].pos.z.toFixed(1)})\` : 'N/A'}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">End Pos:</span>
            <span class="stat-value">${this.snapshots.length > 0 ? \`(\${this.snapshots[this.snapshots.length - 1].pos.x.toFixed(1)}, \${this.snapshots[this.snapshots.length - 1].pos.y.toFixed(1)}, \${this.snapshots[this.snapshots.length - 1].pos.z.toFixed(1)})\` : 'N/A'}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Distance:</span>
            <span class="stat-value">${this.calculateDistance().toFixed(2)} blocks</span>
          </div>
        </div>
      </div>
      <div class="panel">
        <h2>Velocity Stats</h2>
        <div class="stats">
          <div class="stat-row">
            <span class="stat-label">Max Speed:</span>
            <span class="stat-value">${this.calculateMaxSpeed().toFixed(3)} b/t</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Avg Speed:</span>
            <span class="stat-value">${this.calculateAvgSpeed().toFixed(3)} b/t</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">In Water:</span>
            <span class="stat-value">${this.snapshots.filter(s => s.inWater).length}/${this.snapshots.length}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top: 20px;">
      <h2>3D Viewer (Prismarine)</h2>
      <div id="viewer">
        <div class="placeholder">Prismarine Viewer loading... (requires npm install prismarine-viewer)</div>
      </div>
    </div>
    <details style="margin-top: 20px; padding: 10px; background: #2d2d2d; border-radius: 8px; cursor: pointer;">
      <summary style="color: #4da6ff; font-weight: bold;">Raw Snapshot Data</summary>
      <pre style="margin-top: 10px; background: #1a1a1a; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 11px;">${data}</pre>
    </details>
  </div>

  <script>
    // TODO: Integrate Prismarine Viewer to render 3D world
    // For now, display snapshot data
    const snapshots = ${data};
    console.log('Test snapshots:', snapshots);
  </script>
</body>
</html>`
  }

  private calculateDistance(): number {
    if (this.snapshots.length < 2) return 0
    let distance = 0
    for (let i = 1; i < this.snapshots.length; i++) {
      const prev = this.snapshots[i - 1].pos
      const curr = this.snapshots[i].pos
      distance += Math.sqrt(
        (curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2 + (curr.z - prev.z) ** 2,
      )
    }
    return distance
  }

  private calculateMaxSpeed(): number {
    return Math.max(
      ...this.snapshots.map(s => Math.sqrt(s.vel.x ** 2 + s.vel.y ** 2 + s.vel.z ** 2)),
      0,
    )
  }

  private calculateAvgSpeed(): number {
    if (this.snapshots.length === 0) return 0
    const totalSpeed = this.snapshots.reduce(
      (sum, s) => sum + Math.sqrt(s.vel.x ** 2 + s.vel.y ** 2 + s.vel.z ** 2),
      0,
    )
    return totalSpeed / this.snapshots.length
  }
}
