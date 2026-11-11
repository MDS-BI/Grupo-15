import { describe, it, expect } from 'vitest';
import {
  computeProjectedLoad,
  computeStandardTimes,
  computeUtilization,
  detectBottlenecks,
} from '../../src/domain/line-balance.js';

describe('line-balance', () => {
  it('agrupa tiempos estándar por centro y valida números', () => {
    const map = computeStandardTimes([
      { work_center_id: 'wc_corte', setup_time_minutes: 15, run_time_per_unit_minutes: 3 },
      { work_center_id: 'wc_corte', setup_time_minutes: 5, run_time_per_unit_minutes: 2 },
      { work_center_id: 'wc_solda', setup_time_minutes: 10, run_time_per_unit_minutes: 4 },
    ]);
    expect(map.wc_corte).toEqual({
      setup_time_minutes: 20,
      run_time_per_unit_minutes: 5,
      operation_count: 2,
    });
    expect(() =>
      computeStandardTimes([
        { work_center_id: 'wc_corte', setup_time_minutes: -1, run_time_per_unit_minutes: 1 },
      ]),
    ).toThrow(/mayores o iguales/);
  });

  it('proyecta carga con operaciones congeladas y reporta órdenes sin fechas', () => {
    const orders = [
      {
        id: 'po_1',
        status: 'planned',
        routing_id: 'rt_1',
        planned_start_date: '2026-10-01',
        planned_end_date: '2026-10-05',
        quantity_planned: 10,
      },
      {
        id: 'po_2',
        status: 'planned',
        routing_id: 'rt_1',
        planned_start_date: null,
        planned_end_date: null,
        quantity_planned: 10,
      },
      {
        id: 'po_3',
        status: 'cancelled',
        routing_id: 'rt_1',
        planned_start_date: '2026-10-01',
        planned_end_date: '2026-10-05',
        quantity_planned: 10,
      },
    ];
    const routing = [
      {
        routing_id: 'rt_1',
        work_center_id: 'wc_corte',
        setup_time_minutes: 15,
        run_time_per_unit_minutes: 3,
      },
    ];
    const frozen = [
      {
        production_order_id: 'po_1',
        work_center_id: 'wc_corte',
        planned_time_minutes: 45,
      },
    ];
    const result = computeProjectedLoad(
      orders,
      routing,
      { from: '2026-10-01', to: '2026-10-31' },
      frozen,
    );
    expect(result.load_by_work_center.wc_corte).toEqual({ load_minutes: 45, order_count: 1 });
    expect(result.unscheduled_order_ids).toEqual(['po_2']);
  });

  it('calcula utilización y marca capacidad inválida', () => {
    const rows = computeUtilization(
      { wc_corte: { load_minutes: 480 }, wc_solda: { load_minutes: 0 } },
      [
        { id: 'wc_corte', name: 'Corte', capacity_per_day_minutes: 480 },
        { id: 'wc_solda', name: 'Solda', capacity_per_day_minutes: 0 },
      ],
      { from: '2026-10-01', to: '2026-10-01' },
    );
    expect(rows[0]).toMatchObject({
      work_center_id: 'wc_corte',
      utilization: 1,
      invalid_capacity: false,
    });
    expect(rows[1]).toMatchObject({ work_center_id: 'wc_solda', utilization: null });
    expect(rows[1].invalid_capacity).toBe(true);
  });

  it('elige cuello de botella con desempate por carga e id', () => {
    const { bottleneck, candidates } = detectBottlenecks([
      { work_center_id: 'wc_b', name: 'B', load_minutes: 100, utilization: 0.9 },
      { work_center_id: 'wc_a', name: 'A', load_minutes: 200, utilization: 0.9 },
      { work_center_id: 'wc_c', name: 'C', load_minutes: 50, utilization: 0.5 },
    ]);
    expect(candidates).toHaveLength(2);
    expect(bottleneck.work_center_id).toBe('wc_a');
    expect(detectBottlenecks([])).toEqual({ bottleneck: null, candidates: [] });
  });
});
