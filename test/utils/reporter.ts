/**
 * Test report generator for integration tests.
 * Collects results from all test runs and generates a summary HTML.
 */

import { mkdir, writeFile, readdir } from 'node:fs/promises'
import { join, basename } from 'node:path'

export interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'pending'
  duration: number
  viewerPath?: string
  error?: string
}

export interface TestReportConfig {
  outputDir: string
  title?: string
  timestamp?: Date
}

/**
 * Generates an HTML test report with embedded viewer links.
 */
export class TestReporter {
  private results: TestResult[] = []
  private config: TestReportConfig

  constructor(config: TestReportConfig) {
    this.config = {
      title: config.title ?? 'Integration Test Report',
      timestamp: config.timestamp ?? new Date(),
      outputDir: config.outputDir,
    }
  }

  /**
   * Add a test result.
   */
  addResult(result: TestResult): void {
    this.results.push(result)
  }

  /**
   * Generate and save the report.
   */
  async generateReport(): Promise<string> {
    await mkdir(this.config.outputDir, { recursive: true })

    const html = this.generateHTML()
    const reportPath = join(this.config.outputDir, 'report.html')
    await writeFile(reportPath, html, 'utf-8')

    console.log(`[TestReporter] Generated report: ${reportPath}`)
    return reportPath
  }

  /**
   * Generate HTML report.
   */
  private generateHTML(): string {
    const timestamp = this.config.timestamp?.toISOString() ?? new Date().toISOString()
    const passed = this.results.filter((r) => r.status === 'pass').length
    const failed = this.results.filter((r) => r.status === 'fail').length
    const pending = this.results.filter((r) => r.status === 'pending').length
    const total = this.results.length

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.config.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
    h1 { font-size: 28px; margin-bottom: 10px; }
    .subtitle { opacity: 0.9; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .summary-card { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .summary-card.pass { border-left-color: #10b981; }
    .summary-card.fail { border-left-color: #ef4444; }
    .summary-card.pending { border-left-color: #f59e0b; }
    .summary-card .number { font-size: 24px; font-weight: bold; color: #667eea; }
    .summary-card.pass .number { color: #10b981; }
    .summary-card.fail .number { color: #ef4444; }
    .summary-card.pending .number { color: #f59e0b; }
    .summary-card .label { font-size: 12px; text-transform: uppercase; color: #666; margin-top: 5px; }
    .results-table { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .results-table table { width: 100%; border-collapse: collapse; }
    .results-table th { background: #f9fafb; padding: 15px; text-align: left; font-weight: 600; border-bottom: 1px solid #e5e7eb; }
    .results-table td { padding: 15px; border-bottom: 1px solid #e5e7eb; }
    .results-table tr:hover { background: #f9fafb; }
    .status { display: inline-flex; align-items: center; gap: 8px; font-weight: 500; }
    .status.pass { color: #10b981; }
    .status.fail { color: #ef4444; }
    .status.pending { color: #f59e0b; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .duration { font-family: monospace; color: #666; }
    .viewer-link { color: #667eea; text-decoration: none; }
    .viewer-link:hover { text-decoration: underline; }
    .error-message { color: #ef4444; font-family: monospace; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>⛵ ${this.config.title}</h1>
      <p class="subtitle">Generated ${timestamp}</p>
    </header>

    <div class="summary">
      <div class="summary-card pass">
        <div class="number">${passed}</div>
        <div class="label">Passed</div>
      </div>
      <div class="summary-card fail">
        <div class="number">${failed}</div>
        <div class="label">Failed</div>
      </div>
      <div class="summary-card pending">
        <div class="number">${pending}</div>
        <div class="label">Pending</div>
      </div>
      <div class="summary-card">
        <div class="number">${total}</div>
        <div class="label">Total</div>
      </div>
    </div>

    <div class="results-table">
      <table>
        <thead>
          <tr>
            <th>Test</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Viewer</th>
          </tr>
        </thead>
        <tbody>
          ${this.results
            .map(
              (result) => `
          <tr>
            <td>${result.name}</td>
            <td>
              <span class="status ${result.status}">
                <span class="status-dot"></span>
                ${result.status}
              </span>
              ${result.error ? `<div class="error-message">${result.error}</div>` : ''}
            </td>
            <td><span class="duration">${result.duration}ms</span></td>
            <td>
              ${result.viewerPath ? `<a href="${result.viewerPath}" class="viewer-link">View →</a>` : '—'}
            </td>
          </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <footer style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px;">
      <p>mineflayer-boat integration test report • <a href="https://github.com/thtesche/mineflayer-boat" style="color: #667eea;">Project</a></p>
    </footer>
  </div>
</body>
</html>`
  }
}
