import { describe, it, expect } from 'vitest';
import {
  canTransition,
  assertTransition,
  nextStatuses,
  deriveOrderStatus,
  isTerminal,
} from '../../src/domain/order-state-machine.js';
import { ProductionOrderStatus as S } from '../../src/domain/types.js';

describe('order-state-machine', () => {
  it('permite la cadena planned → released → in_progress → completed', () => {
    expect(canTransition(S.PLANNED, S.RELEASED)).toBe(true);
    expect(canTransition(S.RELEASED, S.IN_PROGRESS)).toBe(true);
    expect(canTransition(S.IN_PROGRESS, S.COMPLETED)).toBe(true);
  });

  it('permite cancelar desde cualquier estado no terminal', () => {
    expect(canTransition(S.PLANNED, S.CANCELLED)).toBe(true);
    expect(canTransition(S.RELEASED, S.CANCELLED)).toBe(true);
    expect(canTransition(S.IN_PROGRESS, S.CANCELLED)).toBe(true);
  });

  it('rechaza transiciones inversas y fuera de secuencia', () => {
    expect(canTransition(S.COMPLETED, S.IN_PROGRESS)).toBe(false);
    expect(canTransition(S.IN_PROGRESS, S.PLANNED)).toBe(false);
    expect(canTransition(S.RELEASED, S.COMPLETED)).toBe(false);
  });

  it('marca completed y cancelled como terminales', () => {
    expect(isTerminal(S.COMPLETED)).toBe(true);
    expect(isTerminal(S.CANCELLED)).toBe(true);
    expect(isTerminal(S.IN_PROGRESS)).toBe(false);
    expect(nextStatuses(S.COMPLETED)).toEqual([]);
  });

  it('assertTransition lanza con un mensaje descriptivo', () => {
    expect(() => assertTransition(S.COMPLETED, S.IN_PROGRESS)).toThrow(/Transición de orden inválida/);
    expect(assertTransition(S.PLANNED, S.RELEASED)).toBe(S.RELEASED);
  });

  it('deriva el estado de la orden a partir de sus operaciones', () => {
    expect(deriveOrderStatus([])).toBe(S.RELEASED);
    expect(deriveOrderStatus([{ status: 'pending' }])).toBe(S.RELEASED);
    expect(deriveOrderStatus([{ status: 'pending' }, { status: 'in_progress' }])).toBe(S.IN_PROGRESS);
    expect(deriveOrderStatus([{ status: 'completed' }, { status: 'completed' }])).toBe(S.COMPLETED);
  });
});
