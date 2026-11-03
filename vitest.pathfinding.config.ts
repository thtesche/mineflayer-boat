import { defineConfig } from 'vitest/config'

// Route-planning integration tests only. These place once, drive a long A*
// route around obstacles while mounted, then recover — several minutes of live
// drives in total. Run against a FRESH server in their own CI job so their load
// never piles onto the main integration suite's shared sequential server (which
// would otherwise tip later files' edge-of-channel drives into 'blocked').
export default defineConfig({
  test: {
    include: ['test/integration/pathfinding.test.ts'],
    testTimeout: 120000, // 2 minutes per test
    hookTimeout: 60000,  // 1 minute for setup/teardown
    // Live drives on a shared machine can occasionally miss a confirmation
    // window to a GC pause or CPU spike; each test gets a fresh arena, so retry
    // the rare transient.
    retry: 2,
    globals: true,
    environment: 'node',
    fileParallelism: false,
    pool: 'forks',
    singleFork: true,
    sequence: { concurrent: false },
    reporter: 'verbose',
    outputFile: './test-results/pathfinding.json',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/augment.ts', // Type augmentation only
      ],
    },
  },
})
