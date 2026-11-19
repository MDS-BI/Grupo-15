import { describe, it, expect } from 'vitest';
import {
  buildLineBalanceSuggestions,
  businessDaysInPeriod,
  computeBalanceSummary,
  computeOrderDetail,
  computeProjectedLoad,
  computeStandardTimes,
  computeUtilization,
  detectBottlenecks,
  utilizationStatus,
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

  it('proyecta carga por centro y por orden, y reporta órdenes sin fechas', () => {
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
        sequence: 10,
        setup_time_minutes: 15,
        run_time_per_unit_minutes: 3,
      },
    ];
    const frozen = [
      {
        production_order_id: 'po_1',
        work_center_id: 'wc_corte',
        sequence: 10,
        planned_time_minutes: 45,
      },
    ];
    const result = computeProjectedLoad(
      orders,
      routing,
      { from: '2026-10-01', to: '2026-10-31' },
      frozen,
    );
    expect(result.load_by_work_center.wc_corte).toMatchObject({
      load_minutes: 45,
      order_count: 1,
      order_ids: ['po_1'],
      order_minutes: { po_1: 45 },
    });
    expect(result.load_operations_by_order.po_1).toEqual([
      { work_center_id: 'wc_corte', sequence: 10, load_minutes: 45 },
    ]);
    expect(result.unscheduled_order_ids).toEqual(['po_2']);
  });

  it('cuenta días hábiles del período', () => {
    expect(businessDaysInPeriod({ from: '2026-10-01', to: '2026-10-31' })).toBe(22);
    expect(businessDaysInPeriod({ from: '2026-10-03', to: '2026-10-04' })).toBe(1);
    expect(businessDaysInPeriod({})).toBe(1);
  });

  it('calcula capacidad con días hábiles y factor de eficiencia', () => {
    const rows = computeUtilization(
      { wc_corte: { load_minutes: 850 } },
      [{ id: 'wc_corte', name: 'Corte', capacity_per_day_minutes: 480, efficiency_factor: 0.9 }],
      { from: '2026-10-01', to: '2026-10-31' },
    );
    expect(rows[0]).toMatchObject({
      capacity_minutes: 9504,
      business_days: 22,
      efficiency_factor: 0.9,
      slack_minutes: 8654,
      status: 'normal',
      invalid_capacity: false,
    });
    expect(rows[0].utilization).toBe(0.09);
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
      status: 'bottleneck',
      slack_minutes: 0,
      invalid_capacity: false,
    });
    expect(rows[1]).toMatchObject({
      work_center_id: 'wc_solda',
      utilization: null,
      status: 'unknown',
    });
    expect(rows[1].invalid_capacity).toBe(true);
  });

  it('diferencia estados semánticos por umbral de utilización', () => {
    expect(utilizationStatus(0.749)).toBe('normal');
    expect(utilizationStatus(0.75)).toBe('tight');
    expect(utilizationStatus(0.949)).toBe('tight');
    expect(utilizationStatus(0.95)).toBe('bottleneck');
    expect(utilizationStatus(null)).toBe('unknown');
  });

  it('solo marca cuello de botella a partir del 95% y desempata por carga e id', () => {
    const adjusted = [
      { work_center_id: 'wc_b', name: 'B', load_minutes: 100, utilization: 0.9 },
      { work_center_id: 'wc_a', name: 'A', load_minutes: 200, utilization: 0.9 },
      { work_center_id: 'wc_c', name: 'C', load_minutes: 50, utilization: 0.5 },
    ];
    expect(detectBottlenecks(adjusted)).toEqual({ bottleneck: null, candidates: [] });

    const critical = [
      { work_center_id: 'wc_b', name: 'B', load_minutes: 100, utilization: 0.96 },
      { work_center_id: 'wc_a', name: 'A', load_minutes: 200, utilization: 0.96 },
      { work_center_id: 'wc_c', name: 'C', load_minutes: 50, utilization: 0.94 },
    ];
    const { bottleneck, candidates } = detectBottlenecks(critical);
    expect(candidates).toHaveLength(2);
    expect(bottleneck.work_center_id).toBe('wc_a');
    expect(detectBottlenecks([])).toEqual({ bottleneck: null, candidates: [] });
  });

  it('resume utilización, eficiencia de balanceo y capacidad libre', () => {
    const summary = computeBalanceSummary([
      { load_minutes: 100, capacity_minutes: 100, utilization: 1, slack_minutes: 0 },
      { load_minutes: 50, capacity_minutes: 200, utilization: 0.25, slack_minutes: 150 },
    ]);
    expect(summary.average_utilization).toBe(0.63);
    expect(summary.most_loaded.load_minutes).toBe(100);
    expect(summary.balancing_efficiency).toBe(0.75);
    expect(summary.free_capacity_minutes).toBe(150);
    expect(summary.work_center_count).toBe(2);
  });

  it('ordena el detalle de orden por secuencia de ruta', () => {
    const rows = [
      { work_center_id: 'wc_c', name: 'C', utilization: 0.1 },
      { work_center_id: 'wc_a', name: 'A', utilization: 0.9 },
      { work_center_id: 'wc_b', name: 'B', utilization: 0.5 },
    ];
    const projected = {
      load_operations_by_order: {
        po_1: [
          { work_center_id: 'wc_a', sequence: 20, load_minutes: 20 },
          { work_center_id: 'wc_b', sequence: 10, load_minutes: 10 },
        ],
      },
    };
    const detail = computeOrderDetail(rows, projected, 'po_1');
    expect(detail.map((row) => row.work_center_id)).toEqual(['wc_b', 'wc_a', 'wc_c']);
    expect(detail[0].sequence).toBe(10);
    expect(detail[2].sequence).toBe(null);
  });

  it('construye sugerencias del mismo tipo con la redacción de la demo', () => {
    expect(buildLineBalanceSuggestions({ bottleneck: null })).toEqual([]);
    const workCenters = [
      { id: 'wc_solda', name: 'Estación de Soldadura 1', station_type: 'soldadura' },
      { id: 'wc_solda_2', name: 'Estación de Soldadura 2', station_type: 'soldadura' },
      { id: 'wc_armado', name: 'Línea de Armado', station_type: 'armado' },
      { id: 'wc_calidad', name: 'Control de Calidad', station_type: 'calidad' },
    ];
    const balance = {
      bottleneck: { work_center_id: 'wc_solda', utilization: 0.97 },
      utilization_by_work_center: [
        { work_center_id: 'wc_armado', utilization: 0.13, slack_minutes: 9000 },
        { work_center_id: 'wc_calidad', utilization: 0.04, slack_minutes: 6000 },
        { work_center_id: 'wc_solda_2', utilization: 0, slack_minutes: 8976 },
        { work_center_id: 'wc_solda', utilization: 0.97, slack_minutes: -300 },
      ],
      load_by_work_center: {
        wc_solda: { order_minutes: { po_3007: 6865, po_3003: 1825 } },
      },
    };
    const operations = {
      po_3007: [{ work_center_id: 'wc_solda', sequence: 20, load_minutes: 6865 }],
    };
    const orders = [{ id: 'po_3007', order_number: 'OP-3007' }];
    const suggestions = buildLineBalanceSuggestions(balance, operations, workCenters, orders);
    expect(suggestions.map((item) => item.type)).toEqual(['reassign', 'sequence']);
    expect(suggestions[0]).toMatchObject({
      from_work_center_id: 'wc_solda',
      to_work_center_id: 'wc_solda_2',
      order_id: 'po_3007',
      minutes: 6865,
      sequence: 20,
    });
    expect(suggestions[0].label).toBe(
      'Reasignar 6.865 min de OP-3007 desde Estación de Soldadura 1 a Estación de Soldadura 2 · Sec. 20.',
    );
  });

  it('no propone reasignaciones entre tipos de estación distintos', () => {
    const workCenters = [
      { id: 'wc_solda', name: 'Estación de Soldadura 1', station_type: 'soldadura' },
      { id: 'wc_armado', name: 'Línea de Armado', station_type: 'armado' },
    ];
    const balance = {
      bottleneck: { work_center_id: 'wc_solda', utilization: 0.97 },
      utilization_by_work_center: [
        { work_center_id: 'wc_armado', utilization: 0.13, slack_minutes: 9000 },
        { work_center_id: 'wc_solda', utilization: 0.97, slack_minutes: -300 },
      ],
      load_by_work_center: { wc_solda: { order_minutes: { po_3007: 6865 } } },
    };
    const operations = {
      po_3007: [{ work_center_id: 'wc_solda', sequence: 20, load_minutes: 6865 }],
    };
    const suggestions = buildLineBalanceSuggestions(balance, operations, workCenters);
    expect(suggestions.map((item) => item.type)).toEqual(['sequence']);
    expect(suggestions[0].to_work_center_id).toBeNull();
  });
});
