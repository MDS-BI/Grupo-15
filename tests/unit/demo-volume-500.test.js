import { describe, expect, it } from 'vitest';
import { relativeDay } from '../../src/data/fixtures/demo-dates.js';
import { buildDemoVolume500 } from '../../src/data/fixtures/demo-volume-500.js';

const data = buildDemoVolume500();

describe('demo-volume-500', () => {
  it('genera 500 órdenes con la distribución de estados requerida', () => {
    const counts = data.productionOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    expect(data.productionOrders).toHaveLength(500);
    expect(counts).toEqual({
      completed: 125,
      in_progress: 100,
      released: 100,
      planned: 125,
      cancelled: 50,
    });
  });

  it('reparte las órdenes entre meses anterior, actual y siguiente', () => {
    const anchor = new Date(`${relativeDay(0)}T12:00:00`);
    const keys = [-1, 0, 1].map((offset) => {
      const date = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    });
    const counts = keys.map(
      (key) =>
        data.productionOrders.filter((order) => order.planned_start_date.startsWith(key)).length,
    );

    expect(counts).toEqual([150, 200, 150]);
  });

  it('congela operaciones con tiempos planificados y referencias válidas', () => {
    const orderIds = new Set(data.productionOrders.map((order) => order.id));

    expect(data.productionOrderOperations.length).toBeGreaterThan(0);
    for (const operation of data.productionOrderOperations) {
      expect(orderIds.has(operation.production_order_id)).toBe(true);
      expect(operation.planned_time_minutes).toBeGreaterThan(0);
      expect(operation.status === 'completed' || operation.status === 'pending').toBe(true);
    }
  });
});
