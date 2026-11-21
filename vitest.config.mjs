import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Con jsdom global, localStorage sobrevive entre pruebas de una misma
    // suite; se limpia para que cada prueba arranque desde los fixtures.
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,
    hookTimeout: 30000,
    // Estas 12 suites heredadas de 001 importan src/storage.js, src/app.js o
    // src/module-config.js, que no existen en el módulo de manufactura; se
    // excluyen (conservando los excludes por defecto) para que el gate cubra
    // solo las suites vigentes. Deuda documentada en T084.
    exclude: [
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
      'tests/unit/module-config.test.js',
      'tests/unit/storage.test.js',
    ],
  },
});
