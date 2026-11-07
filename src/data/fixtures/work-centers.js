/**
 * @file Fixtures de centros de trabajo (work_centers). Ver data-model.md §3.8.
 * `operational_status` alimenta el semáforo de supervisión y mantenimiento.
 */

export const workCenters = [
  {
    id: 'wc_corte', company_id: 'cmp_1', code: 'CT-CORTE', name: 'Estación de Corte',
    warehouse_id: 'wh_wip', capacity_per_day_minutes: 480, efficiency_factor: 0.9,
    cost_per_hour: 15000, status: 'active', operational_status: 'fault',
  },
  {
    id: 'wc_solda', company_id: 'cmp_1', code: 'CT-SOLDA', name: 'Estación de Soldadura',
    warehouse_id: 'wh_wip', capacity_per_day_minutes: 480, efficiency_factor: 0.85,
    cost_per_hour: 22000, status: 'active', operational_status: 'available',
  },
  {
    id: 'wc_pintura', company_id: 'cmp_1', code: 'CT-PINT', name: 'Cabina de Pintura',
    warehouse_id: 'wh_wip', capacity_per_day_minutes: 420, efficiency_factor: 0.8,
    cost_per_hour: 18000, status: 'active', operational_status: 'available',
  },
  {
    id: 'wc_armado', company_id: 'cmp_1', code: 'CT-ARM', name: 'Línea de Armado',
    warehouse_id: 'wh_wip', capacity_per_day_minutes: 960, efficiency_factor: 0.95,
    cost_per_hour: 12000, status: 'active', operational_status: 'in_operation',
  },
  {
    id: 'wc_calidad', company_id: 'cmp_1', code: 'CT-QC', name: 'Control de Calidad',
    warehouse_id: 'wh_pt', capacity_per_day_minutes: 480, efficiency_factor: 1.0,
    cost_per_hour: 16000, status: 'active', operational_status: 'available',
  },
];
