import { configDefaults, defineConfig } from 'vitest/config';

const exclude = [
  ...configDefaults.exclude,
  'tests/integration/add-document.test.js',
  'tests/integration/create-entity.test.js',
  'tests/integration/custom-fields.test.js',
  'tests/integration/dashboard.test.js',
  'tests/integration/edit-delete-entity.test.js',
  'tests/integration/manage-document.test.js',
  'tests/integration/manage-tabs.test.js',
  'tests/integration/relabeling.test.js',
  'tests/integration/search-entities.test.js',
  'tests/integration/workspace-shell.test.js',
  'tests/unit/html-escaping.test.js',
  'tests/unit/module-config.test.js',
  'tests/unit/storage.test.js',
];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.js'],
          exclude,
          environment: 'node',
          setupFiles: ['./tests/setup.js'],
          fileParallelism: true,
          hookTimeout: 30000,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.js', 'tests/unit/html-escaping.test.js'],
          exclude,
          environment: 'jsdom',
          setupFiles: ['./tests/setup.js'],
          fileParallelism: true,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
