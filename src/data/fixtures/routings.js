/**
 * @file Fixtures de rutas de fabricación (routings, routing_operations).
 * Ver data-model.md §3.9–3.10.
 */

export const routings = [
  { id: 'rt_bici', company_id: 'cmp_1', product_id: 'prod_bici', code: 'RT-BICI-01', version: 'A', status: 'active' },
  { id: 'rt_cuadro', company_id: 'cmp_1', product_id: 'prod_cuadro', code: 'RT-CUADRO-01', version: 'A', status: 'active' },
  { id: 'rt_rueda', company_id: 'cmp_1', product_id: 'prod_rueda', code: 'RT-RUEDA-01', version: 'A', status: 'active' },
];

export const routingOperations = [
  // Ruta de la bicicleta: Corte → Armado → Inspección final
  { id: 'ro_bici_1', routing_id: 'rt_bici', work_center_id: 'wc_corte', sequence: 10, description: 'Corte de tubos y preparación', setup_time_minutes: 15, run_time_per_unit_minutes: 3 },
  { id: 'ro_bici_2', routing_id: 'rt_bici', work_center_id: 'wc_armado', sequence: 20, description: 'Armado de componentes', setup_time_minutes: 10, run_time_per_unit_minutes: 12 },
  { id: 'ro_bici_3', routing_id: 'rt_bici', work_center_id: 'wc_calidad', sequence: 30, description: 'Inspección final', setup_time_minutes: 5, run_time_per_unit_minutes: 2 },
  // Ruta del cuadro: Corte → Soldadura → Pintura
  { id: 'ro_cuadro_1', routing_id: 'rt_cuadro', work_center_id: 'wc_corte', sequence: 10, description: 'Corte de tubos', setup_time_minutes: 20, run_time_per_unit_minutes: 5 },
  { id: 'ro_cuadro_2', routing_id: 'rt_cuadro', work_center_id: 'wc_solda', sequence: 20, description: 'Soldadura del cuadro', setup_time_minutes: 25, run_time_per_unit_minutes: 18 },
  { id: 'ro_cuadro_3', routing_id: 'rt_cuadro', work_center_id: 'wc_pintura', sequence: 30, description: 'Pintura en polvo', setup_time_minutes: 30, run_time_per_unit_minutes: 8 },
  // Ruta de la rueda: Armado → Inspección
  { id: 'ro_rueda_1', routing_id: 'rt_rueda', work_center_id: 'wc_armado', sequence: 10, description: 'Armado de llanta, rayos y maza', setup_time_minutes: 10, run_time_per_unit_minutes: 7 },
  { id: 'ro_rueda_2', routing_id: 'rt_rueda', work_center_id: 'wc_calidad', sequence: 20, description: 'Inspección de rueda', setup_time_minutes: 5, run_time_per_unit_minutes: 1 },
];
