import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    testTimeout: 120000, // 2 minutes per test
    hookTimeout: 60000,  // 1 minute for setup/teardown
    globals: true,
    environment: 'node',
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
