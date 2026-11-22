import { describe, it, expect } from 'vitest';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { maintenanceCauses, technicians } from '../../src/data/fixtures/maintenance-tickets.js';
import {
  createFixtureSnapshot,
  loadSnapshot,
  resetDemoSnapshot,
} from '../../src/data/persistence.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

function thresholdValue(storage) {
  const snapshot = loadSnapshot(storage);
  if (!snapshot) return null;
  return snapshot.data.thresholdSettings.find((row) => row.indicator === 'load').threshold;
}

describe('Reinicio de datos de demo', () => {
  it('crea un snapshot v2 completo desde los fixtures', () => {
    const data = createFixtureSnapshot();

    expect(data.companies.length).toBeGreaterThan(0);
    expect(data.productionOrders.length).toBeGreaterThan(0);
    expect(data.thresholdSettings.length).toBeGreaterThan(0);
    expect(data.rolePermissions.length).toBeGreaterThan(0);
    expect(data).not.toHaveProperty('technicians');
    expect(data).not.toHaveProperty('maintenanceCauses');
  });

  it('restaura fixture y versión v2 después de una modificación', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });
    const original = thresholdValue(storage) ?? 0.85;

    store.setIndicatorThreshold({ indicator: 'load', threshold: 0.99, comparison: 'gt' });
    store.technicians[0].name = 'Técnico temporal';
    store.maintenanceCauses[0].label = 'Causa temporal';
    expect(thresholdValue(storage)).toBe(0.99);

    const reset = store.resetDemoData();
    expect(reset).toBe(true);
    expect(store.technicians[0].name).toBe(technicians[0].name);
    expect(store.maintenanceCauses[0].label).toBe(maintenanceCauses[0].label);
    expect(loadSnapshot(storage).version).toBe(2);
    expect(thresholdValue(storage)).toBe(original);
    expect(store.thresholdSettings.find((row) => row.indicator === 'load').threshold).toBe(
      original,
    );

    const reloaded = new ManufacturingStore({ storage });
    expect(reloaded.thresholdSettings.find((row) => row.indicator === 'load').threshold).toBe(
      original,
    );
  });

  it('permite reiniciar el snapshot directamente desde persistencia', () => {
    const storage = memoryStorage();
    storage.setItem('erp.manufacturing.v2', JSON.stringify({ version: 1, data: {} }));

    expect(resetDemoSnapshot(storage)).toBe(true);
    expect(loadSnapshot(storage).version).toBe(2);
  });
});
