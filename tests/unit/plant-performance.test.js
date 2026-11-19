import { describe, it, expect } from 'vitest';
import {
  accumulateDowntimesByReason,
  buildConsolidatedReport,
  canPerformAction,
  computeLoadByWorkCenter,
  computeOee,
  daysInPeriod,
  evaluateThresholds,
} from '../../src/domain/plant-performance.js';

describe('plant-performance', () => {
  it('cuenta días hábiles inclusivos del período', () => {
    expect(daysInPeriod({ from: '2026-10-01', to: '2026-10-31' })).toBe(22);
    expect(daysInPeriod({ from: '2026-10-01', to: '2026-10-01' })).toBe(1);
    expect(daysInPeriod({})).toBe(1);
  });

  it('calcula disponibilidad, rendimiento, calidad y OEE', () => {
    const operations = [
      {
        id: 'op_1',
        work_center_id: 'wc_corte',
        completed_at: '2026-10-02T10:00:00Z',
        planned_time_minutes: 100,
        quantity_completed: 90,
        scrap_quantity: 10,
        run_time_per_unit_minutes: 1,
        quantity_planned: 100,
      },
    ];
    const delays = [
      {
        po_operation_id: 'op_1',
        status: 'closed',
        duration_minutes: 10,
        ended_at: '2026-10-02T10:00:00Z',
      },
    ];
    const oee = computeOee('wc_corte', operations, delays, {
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(oee.availability).toBeCloseTo(0.9, 5);
    expect(oee.performance).toBeCloseTo(0.9, 5);
    expect(oee.quality).toBeCloseTo(0.9, 5);
    expect(oee.oee).toBeCloseTo(0.729, 5);
    expect(computeOee('wc_solda', operations, delays)).toBeNull();
  });

  it('incluye operaciones sin fecha y excluye las fuera del período', () => {
    const workCenters = [
      { id: 'wc_corte', name: 'Corte', capacity_per_day_minutes: 480, efficiency_factor: 0.9 },
    ];
    const operations = [
      { work_center_id: 'wc_corte', planned_time_minutes: 100 },
      {
        work_center_id: 'wc_corte',
        planned_time_minutes: 50,
        completed_at: '2026-10-15T08:00:00Z',
      },
      {
        work_center_id: 'wc_corte',
        planned_time_minutes: 999,
        completed_at: '2026-12-01T08:00:00Z',
      },
    ];
    const load = computeLoadByWorkCenter(workCenters, operations, {
      from: '2026-10-15',
      to: '2026-10-15',
    });
    expect(load.wc_corte.load_minutes).toBe(150);
    expect(load.wc_corte.capacity_minutes).toBe(432);
    expect(load.wc_corte.load_ratio).toBe(0.35);
    expect(load.wc_corte.invalid_capacity).toBe(false);
  });

  it('marca la capacidad inválida en lugar de inventar un minuto', () => {
    const workCenters = [
      { id: 'wc_solda', name: 'Solda', capacity_per_day_minutes: 0, efficiency_factor: 0.85 },
    ];
    const load = computeLoadByWorkCenter(
      workCenters,
      [{ work_center_id: 'wc_solda', planned_time_minutes: 100 }],
      { from: '2026-10-15', to: '2026-10-15' },
    );
    expect(load.wc_solda).toMatchObject({
      load_minutes: 100,
      capacity_minutes: null,
      load_ratio: null,
      invalid_capacity: true,
      inactive: true,
    });
  });

  it('acumula paradas sin duplicar el ticket ligado a un atraso', () => {
    const delays = [
      {
        id: 'od_1',
        delay_reason_id: 'dr_mecanico',
        status: 'closed',
        duration_minutes: 30,
        ended_at: '2026-10-02T09:00:00Z',
      },
    ];
    const tickets = [
      {
        ticket_status: 'resolved',
        operation_delay_id: 'od_1',
        cause_reason_id: 'dr_mecanico',
        resolved_at: '2026-10-02T09:00:00Z',
        downtime_minutes: 30,
      },
      {
        ticket_status: 'resolved',
        cause_reason_id: 'dr_electrico',
        resolved_at: '2026-10-03T09:00:00Z',
        downtime_minutes: 15,
      },
    ];
    const rows = accumulateDowntimesByReason(
      delays,
      tickets,
      { from: '2026-10-01', to: '2026-10-31' },
      [
        { id: 'dr_mecanico', label: 'Mecánico' },
        { id: 'dr_electrico', label: 'Eléctrico' },
      ],
    );
    expect(rows).toEqual([
      { reason_id: 'dr_mecanico', reason_label: 'Mecánico', downtime_minutes: 30 },
      { reason_id: 'dr_electrico', reason_label: 'Eléctrico', downtime_minutes: 15 },
    ]);
  });

  it('evalúa umbrales gt/lt y aplica deny-by-default', () => {
    const settings = [
      { indicator: 'load', threshold: 0.85, comparison: 'gt' },
      { indicator: 'oee', threshold: 0.7, comparison: 'lt' },
      { indicator: 'downtime', threshold: 120, comparison: 'gt' },
    ];
    const result = evaluateThresholds({ load: 0.9, oee: 0.65, downtime: 100 }, settings);
    expect(result.find((row) => row.indicator === 'load').breached).toBe(true);
    expect(result.find((row) => row.indicator === 'oee').breached).toBe(true);
    expect(result.find((row) => row.indicator === 'downtime').breached).toBe(false);

    const permissions = [{ role: 'planner', action: 'export_report', allowed: true }];
    expect(canPerformAction('planner', 'export_report', permissions)).toBe(true);
    expect(canPerformAction('operator', 'export_report', permissions)).toBe(false);
  });

  it('compone un reporte consolidado serializable', () => {
    const report = buildConsolidatedReport(
      { from: '2026-10-01', to: '2026-10-31', label: 'Octubre' },
      { generated_at: '2026-11-01T00:00:00Z' },
    );
    expect(report.period.label).toBe('Octubre');
    expect(report.generated_at).toBe('2026-11-01T00:00:00Z');
    expect(report.downtime_by_reason).toEqual([]);
    expect(report.fulfillment).toEqual({
      completed_on_time: 0,
      total_with_due_date: 0,
      ratio: null,
    });
  });
});
