import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    testTimeout: 120000, // 2 minutes per test
    hookTimeout: 60000,  // 1 minute for setup/teardown
    // These run against a live server sharing one machine with the test
    // client, so a GC pause or CPU spike can occasionally push a place/board/
    // leave confirmation past its window. The tests are correct and each gets a
    // fresh arena in beforeEach, so retry the rare transient timeout.
    retry: 2,
    globals: true,
    environment: 'node',
    // All files share one Minecraft world, so they must not run concurrently:
    // each file's buildArena runs `kill @e` and re-fills the channel, which
    // would wipe out boats from any file running at the same time.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    sequence: { concurrent: false },
    reporter: 'verbose',
    outputFile: './test-results/integration.json',
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
