import { configDefaults, defineConfig } from 'vitest/config';

const isolatedLegacySuites = [
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
  'tests/unit/module-config.test.js',
  'tests/unit/storage.test.js',
];

export default defineConfig({
  test: {
    fileParallelism: false,
    hookTimeout: 30000,
    exclude: [...configDefaults.exclude, ...isolatedLegacySuites],
  },
});
