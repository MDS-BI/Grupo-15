/**
 * @file Fixtures de estructuras de materiales (BOM) multi-nivel.
 * Grafo: Bicicleta → (Cuadro, Rueda, ...); Cuadro → Tubo, Pintura, Soldadura;
 * Rueda → Llanta, Rayos, Maza. Ver data-model.md §3.6–3.7.
 */

export const billOfMaterials = [
  // Bien terminado principal
  {
    id: 'bom_bici', company_id: 'cmp_1', product_id: 'prod_bici', code: 'BOM-BICI-01',
    version: 'A', effective_from: '2026-01-01', effective_to: null, base_quantity: 1,
    status: 'active', notes: 'Estructura vigente de la bicicleta urbana.',
  },
  // Sub-ensamble: Cuadro
  {
    id: 'bom_cuadro', company_id: 'cmp_1', product_id: 'prod_cuadro', code: 'BOM-CUADRO-01',
    version: 'A', effective_from: '2026-01-01', effective_to: null, base_quantity: 1,
    status: 'active', notes: 'Sub-ensamble soldado.',
  },
  // Sub-ensamble: Rueda
  {
    id: 'bom_rueda', company_id: 'cmp_1', product_id: 'prod_rueda', code: 'BOM-RUEDA-01',
    version: 'A', effective_from: '2026-01-01', effective_to: null, base_quantity: 1,
    status: 'active', notes: 'Sub-ensamble de rueda armada.',
  },
];

export const bomComponents = [
  // Bicicleta → Cuadro (1) + Rueda (2)
  { id: 'bc_1', bom_id: 'bom_bici', component_product_id: 'prod_cuadro', quantity_per_unit: 1, uom_id: 'uom_un', scrap_percentage: 0, sequence: 10, is_optional: false },
  { id: 'bc_2', bom_id: 'bom_bici', component_product_id: 'prod_rueda', quantity_per_unit: 2, uom_id: 'uom_un', scrap_percentage: 0, sequence: 20, is_optional: false },
  // Rueda → Llanta (1) + Rayos (1) + Maza (1)
  { id: 'bc_3', bom_id: 'bom_rueda', component_product_id: 'comp_llanta', quantity_per_unit: 1, uom_id: 'uom_un', scrap_percentage: 0, sequence: 10, is_optional: false },
  { id: 'bc_4', bom_id: 'bom_rueda', component_product_id: 'comp_rayos', quantity_per_unit: 1, uom_id: 'uom_un', scrap_percentage: 0, sequence: 20, is_optional: false },
  { id: 'bc_5', bom_id: 'bom_rueda', component_product_id: 'comp_maza', quantity_per_unit: 1, uom_id: 'uom_un', scrap_percentage: 0, sequence: 30, is_optional: false },
  // Cuadro → Tubo (6m) + Pintura (0.8kg) + Soldadura (0.4kg)
  { id: 'bc_6', bom_id: 'bom_cuadro', component_product_id: 'comp_tubo', quantity_per_unit: 6, uom_id: 'uom_m', scrap_percentage: 2, sequence: 10, is_optional: false },
  { id: 'bc_7', bom_id: 'bom_cuadro', component_product_id: 'rm_pintura', quantity_per_unit: 0.8, uom_id: 'uom_kg', scrap_percentage: 5, sequence: 20, is_optional: false },
  { id: 'bc_8', bom_id: 'bom_cuadro', component_product_id: 'rm_soldadura', quantity_per_unit: 0.4, uom_id: 'uom_kg', scrap_percentage: 0, sequence: 30, is_optional: false },
];
