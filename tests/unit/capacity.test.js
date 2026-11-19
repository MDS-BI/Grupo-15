import { describe, it, expect } from 'vitest';
import {
  businessDaysInPeriod,
  capacityFor,
  effectiveDailyCapacity,
  efficiencyFactorOf,
  loadRatio,
  round2,
} from '../../src/domain/capacity.js';

const wcCorte = {
  id: 'wc_corte',
  name: 'Estación de Corte',
  capacity_per_day_minutes: 480,
  efficiency_factor: 0.9,
};

describe('capacity', () => {
  it('redondea a 2 decimales', () => {
    expect(round2(150 / 432)).toBe(0.35);
    expect(round2(850 / 9504)).toBe(0.09);
  });

  it('cuenta días hábiles del período', () => {
    expect(businessDaysInPeriod({ from: '2026-10-01', to: '2026-10-31' })).toBe(22);
    expect(businessDaysInPeriod({ from: '2026-11-01', to: '2026-11-30' })).toBe(21);
    expect(businessDaysInPeriod({ from: '2026-10-01', to: '2026-11-30' })).toBe(43);
    expect(businessDaysInPeriod({ from: '2026-10-03', to: '2026-10-04' })).toBe(1);
    expect(businessDaysInPeriod({})).toBe(1);
  });

  it('sanea el factor de eficiencia', () => {
    expect(efficiencyFactorOf(wcCorte)).toBe(0.9);
    expect(efficiencyFactorOf({ efficiency_factor: 0 })).toBe(1);
    expect(efficiencyFactorOf({ efficiency_factor: -1 })).toBe(1);
    expect(efficiencyFactorOf({})).toBe(1);
  });

  it('deriva la capacidad diaria y la del período desde los mismos campos', () => {
    expect(effectiveDailyCapacity(wcCorte)).toBe(432);
    expect(capacityFor(wcCorte, { from: '2026-10-01', to: '2026-10-31' })).toEqual({
      business_days: 22,
      efficiency_factor: 0.9,
      effective_per_day_minutes: 432,
      capacity_minutes: 9504,
      invalid_capacity: false,
    });
  });

  it('marca capacidad inválida en vez de devolver cero', () => {
    const withoutCapacity = { capacity_per_day_minutes: 0, efficiency_factor: 0.85 };
    expect(effectiveDailyCapacity(withoutCapacity)).toBeNull();
    expect(capacityFor(withoutCapacity, { from: '2026-10-01', to: '2026-10-31' })).toMatchObject({
      capacity_minutes: null,
      effective_per_day_minutes: null,
      invalid_capacity: true,
    });
  });

  it('calcula el ratio y devuelve null sin capacidad', () => {
    expect(loadRatio(8690, 8976)).toBe(0.97);
    expect(loadRatio(150, 432)).toBe(0.35);
    expect(loadRatio(150, null)).toBeNull();
    expect(loadRatio(150, 0)).toBeNull();
  });
});
