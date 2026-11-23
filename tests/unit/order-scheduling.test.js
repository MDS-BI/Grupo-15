import { describe, it, expect } from 'vitest';
import {
  canRescheduleOrder,
  isValidIsoDate,
  sortOrdersForScheduling,
  validatePlannedDates,
} from '../../src/domain/order-scheduling.js';

describe('order-scheduling', () => {
  it('acepta solo fechas ISO existentes en el calendario', () => {
    expect(isValidIsoDate(null)).toBe(true);
    expect(isValidIsoDate('2026-10-31')).toBe(true);
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2025-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('31-10-2026')).toBe(false);
  });

  it('valida rango invertido y fechas inválidas', () => {
    expect(
      validatePlannedDates({ planned_start_date: '2026-10-01', planned_end_date: '2026-10-10' }),
    ).toEqual({ valid: true });
    expect(
      validatePlannedDates({ planned_start_date: '2026-10-10', planned_end_date: '2026-10-01' }),
    ).toEqual({ valid: false, error: 'rango_invertido' });
    expect(
      validatePlannedDates({ planned_start_date: '2026-02-30', planned_end_date: null }),
    ).toEqual({ valid: false, error: 'fecha_invalida' });
  });

  it('valida horas HH:mm, rango horario y conserva los errores de fecha', () => {
    const dates = { planned_start_date: '2026-10-01', planned_end_date: '2026-10-10' };
    expect(validatePlannedDates(dates)).toEqual({ valid: true });
    expect(
      validatePlannedDates({
        ...dates,
        scheduled_start_time: '08:00',
        scheduled_end_time: '16:00',
      }),
    ).toEqual({ valid: true });
    expect(
      validatePlannedDates({ ...dates, scheduled_start_time: '8:00', scheduled_end_time: '16:00' }),
    ).toEqual({ valid: false, error: 'hora_invalida' });
    expect(
      validatePlannedDates({
        ...dates,
        scheduled_start_time: '24:00',
        scheduled_end_time: '16:00',
      }),
    ).toEqual({ valid: false, error: 'hora_invalida' });
    expect(
      validatePlannedDates({
        ...dates,
        scheduled_start_time: '16:00',
        scheduled_end_time: '08:00',
      }),
    ).toEqual({ valid: false, error: 'rango_horario_invertido' });
    expect(
      validatePlannedDates({
        ...dates,
        scheduled_start_time: '16:00',
        scheduled_end_time: '16:00',
      }),
    ).toEqual({ valid: false, error: 'rango_horario_invertido' });
    expect(
      validatePlannedDates({
        planned_start_date: '2026-10-10',
        planned_end_date: '2026-10-01',
        scheduled_start_time: '25:00',
        scheduled_end_time: '16:00',
      }),
    ).toEqual({ valid: false, error: 'rango_invertido' });
    expect(
      validatePlannedDates({
        planned_start_date: '2026-02-30',
        planned_end_date: null,
        scheduled_start_time: '25:00',
      }),
    ).toEqual({ valid: false, error: 'fecha_invalida' });
  });

  it('no permite reprogramar órdenes cerradas', () => {
    expect(canRescheduleOrder({ status: 'planned' })).toBe(true);
    expect(canRescheduleOrder({ status: 'in_progress' })).toBe(true);
    expect(canRescheduleOrder({ status: 'completed' })).toBe(false);
    expect(canRescheduleOrder({ status: 'cancelled' })).toBe(false);
    expect(canRescheduleOrder(null)).toBe(false);
  });

  it('ordena por fecha, prioridad y número dejando nulos al final', () => {
    const orders = [
      { id: 'c', order_number: 'PO-3', planned_start_date: null, priority: 'high' },
      { id: 'b', order_number: 'PO-2', planned_start_date: '2026-10-05', priority: 'low' },
      { id: 'a', order_number: 'PO-1', planned_start_date: '2026-10-05', priority: 'high' },
      { id: 'd', order_number: 'PO-0', planned_start_date: '2026-10-01', priority: 'low' },
    ];
    expect(sortOrdersForScheduling(orders).map((order) => order.id)).toEqual(['d', 'a', 'b', 'c']);
  });
});
