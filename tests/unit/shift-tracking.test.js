import { describe, it, expect } from 'vitest';
import {
  activeShiftOf,
  canStartDelay,
  canStartShift,
  computeEffectiveMinutes,
  elapsedMinutes,
  hasOpenDelay,
  openDelayOf,
  sumClosedDelayMinutes,
  validateCounter,
  validateCumulative,
} from '../../src/domain/shift-tracking.js';

const closed = (minutes) => ({ status: 'closed', duration_minutes: minutes });
const open = { status: 'open', duration_minutes: null };

describe('shift-tracking', () => {
  it('calcula minutos transcurridos y rechaza rangos inválidos', () => {
    expect(elapsedMinutes('2026-10-02T08:00:00Z', '2026-10-02T09:30:00Z')).toBe(90);
    expect(() => elapsedMinutes('2026-10-02T09:30:00Z', '2026-10-02T08:00:00Z')).toThrow(
      /anterior/,
    );
    expect(() => elapsedMinutes('no-es-fecha', '2026-10-02T08:00:00Z')).toThrow(/válidas/);
  });

  it('resta solo atrasos cerrados y nunca devuelve negativo', () => {
    expect(
      computeEffectiveMinutes('2026-10-02T08:00:00Z', '2026-10-02T10:00:00Z', [closed(15), open]),
    ).toBe(105);
    expect(
      computeEffectiveMinutes('2026-10-02T08:00:00Z', '2026-10-02T08:10:00Z', [closed(30)]),
    ).toBe(0);
  });

  it('suma duraciones cerradas e ignora atrasos abiertos', () => {
    expect(sumClosedDelayMinutes([closed(5), closed(10.5), open])).toBe(15.5);
    expect(hasOpenDelay([closed(1), open])).toBe(true);
    expect(openDelayOf([closed(1), open])).toBe(open);
    expect(openDelayOf([closed(1)])).toBeNull();
  });

  it('encuentra el turno activo de una operación', () => {
    const shifts = [
      { po_operation_id: 'op_1', status: 'completed' },
      { po_operation_id: 'op_1', status: 'in_progress' },
    ];
    expect(activeShiftOf(shifts, 'op_1')).toBe(shifts[1]);
    expect(activeShiftOf(shifts, 'op_2')).toBeNull();
  });

  it('valida contadores no negativos y numéricos', () => {
    expect(validateCounter('12')).toBe(12);
    expect(validateCounter(0)).toBe(0);
    expect(() => validateCounter(-1)).toThrow(/negativo/);
    expect(() => validateCounter('abc')).toThrow(/número válido/);
  });

  it('valida el acumulado contra la cantidad planificada', () => {
    expect(validateCumulative(100, 100)).toBe(100);
    expect(() => validateCumulative(101, 100)).toThrow(/superar/);
    expect(() => validateCumulative(-1, 100)).toThrow(/negativo/);
    expect(() => validateCumulative(1, null)).toThrow(/planificada/);
  });

  it('impide iniciar turno sobre operación cerrada o con turno activo', () => {
    expect(canStartShift({ status: 'in_progress' }, null)).toBe(true);
    expect(canStartShift({ status: 'completed' }, null)).toBe(false);
    expect(canStartShift({ status: 'in_progress' }, { id: 'sh_1' })).toBe(false);
    expect(canStartShift({ status: 'in_progress' }, null, { activeOperatorShift: true })).toBe(
      false,
    );
  });

  it('solo permite atrasos en operación en progreso y sin otro abierto', () => {
    expect(canStartDelay({ status: 'in_progress' }, null)).toBe(true);
    expect(canStartDelay({ status: 'in_progress' }, open)).toBe(false);
    expect(canStartDelay({ status: 'pending' }, null)).toBe(false);
  });
});
