import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.js'],
          environment: 'node',
          setupFiles: ['./tests/setup.js'],
          fileParallelism: true,
          hookTimeout: 30000,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.js'],
          environment: 'jsdom',
          setupFiles: ['./tests/setup.js'],
          fileParallelism: true,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
