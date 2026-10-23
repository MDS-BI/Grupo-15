import { describe, it, expect } from 'vitest';
import {
  plannedTimeMinutes,
  totalPlannedTime,
  effectiveCapacityPerDay,
  capacityUtilization,
} from '../../src/domain/operation-planning.js';

const op = { setup_time_minutes: 15, run_time_per_unit_minutes: 3 };

describe('operation-planning', () => {
  it('calcula planned_time_minutes = setup + run × cantidad', () => {
    expect(plannedTimeMinutes(op, 50)).toBe(165);
    expect(plannedTimeMinutes(op, 0)).toBe(15);
  });

  it('maneja entradas inválidas como cero', () => {
    expect(plannedTimeMinutes({}, 10)).toBe(0);
    expect(plannedTimeMinutes(op, null)).toBe(15);
  });

  it('suma el tiempo estándar total de una ruta', () => {
    const ops = [op, { setup_time_minutes: 10, run_time_per_unit_minutes: 12 }];
    expect(totalPlannedTime(ops, 10)).toBe(45 + 130);
  });

  it('aplica el efficiency_factor a la capacidad', () => {
    const wc = { capacity_per_day_minutes: 480, efficiency_factor: 0.9 };
    expect(effectiveCapacityPerDay(wc)).toBe(432);
  });

  it('calcula la utilización con sobrecarga', () => {
    const wc = { capacity_per_day_minutes: 480, efficiency_factor: 1 };
    expect(capacityUtilization(240, wc)).toBe(0.5);
    expect(capacityUtilization(960, wc)).toBe(2);
  });
});
