/**
 * @file Fixtures del catálogo de motivos de atraso (US-06).
 * Ver data-model.md §3.17.
 */

export const delayReasons = [
  {
    id: 'dr_falta_material',
    company_id: 'cmp_1',
    label: 'Falta de material',
    origin: 'predefined',
    scope: 'global',
    production_shift_id: null,
    active: true,
    created_by: null,
  },
  {
    id: 'dr_falla_maquina',
    company_id: 'cmp_1',
    label: 'Falla de máquina',
    origin: 'predefined',
    scope: 'global',
    production_shift_id: null,
    active: true,
    created_by: null,
  },
  {
    id: 'dr_cambio_producto',
    company_id: 'cmp_1',
    label: 'Cambio de producto',
    origin: 'predefined',
    scope: 'global',
    production_shift_id: null,
    active: true,
    created_by: null,
  },
  {
    id: 'dr_espera_calidad',
    company_id: 'cmp_1',
    label: 'Espera de control de calidad',
    origin: 'predefined',
    scope: 'global',
    production_shift_id: null,
    active: true,
    created_by: null,
  },
  {
    id: 'dr_custom_1',
    company_id: 'cmp_1',
    label: 'Ajuste de herramienta',
    origin: 'custom',
    scope: 'shift',
    production_shift_id: 'sh_3002_2',
    active: true,
    created_by: 'emp_op_02',
  },
];
