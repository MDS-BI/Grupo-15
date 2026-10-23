import { describe, it, expect } from 'vitest';
import { reconcileConsumption, requiresReview, DEFAULT_TOLERANCE } from '../../src/domain/reconciliation.js';

const bomComponents = [
  { id: 'bc1', component_product_id: 'comp_tubo', quantity_per_unit: 6, scrap_percentage: 0 },
  { id: 'bc2', component_product_id: 'rm_pintura', quantity_per_unit: 0.8, scrap_percentage: 5 },
];

describe('reconciliation', () => {
  it('calcula la varianza dentro de tolerancia como ok', () => {
    // teórico tubo = 6 × 10 = 60; real 61
    const [tubo] = reconcileConsumption({
      bomComponents,
      consumptions: [{ component_product_id: 'comp_tubo', quantity_consumed: 61 }],
      quantityPlanned: 10,
    });
    expect(tubo.theoretical_quantity).toBe(60);
    expect(tubo.actual_quantity).toBe(61);
    expect(tubo.flag).toBe('over');
    expect(tubo.within_tolerance).toBe(true);
  });

  it('detecta sobreconsumo fuera de tolerancia', () => {
    const [tubo] = reconcileConsumption({
      bomComponents,
      consumptions: [{ component_product_id: 'comp_tubo', quantity_consumed: 90 }],
      quantityPlanned: 10,
    });
    expect(tubo.within_tolerance).toBe(false);
    expect(requiresReview([tubo])).toBe(true);
  });

  it('marca el uso no planificado', () => {
    const result = reconcileConsumption({
      bomComponents,
      consumptions: [{ component_product_id: 'comp_inesperado', quantity_consumed: 5 }],
      quantityPlanned: 10,
    });
    const unplanned = result.find((r) => r.component_product_id === 'comp_inesperado');
    expect(unplanned.flag).toBe('unplanned');
    expect(unplanned.within_tolerance).toBe(false);
  });

  it('incluye la merma en el teórico', () => {
    const [, pintura] = reconcileConsumption({
      bomComponents,
      consumptions: [],
      quantityPlanned: 10,
    });
    // 0.8 × 1.05 × 10 = 8.4
    expect(pintura.theoretical_quantity).toBe(8.4);
    expect(pintura.flag).toBe('under');
  });

  it('expone la tolerancia por defecto ±5%', () => {
    expect(DEFAULT_TOLERANCE).toBe(0.05);
  });
});
