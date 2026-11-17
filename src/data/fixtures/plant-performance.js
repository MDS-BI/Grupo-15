/**
 * @file Fixtures de configuración del panel de planta (US-08): umbrales y
 * matriz rol×acción simulada. Ver data-model.md §3.21–3.22.
 */

export const thresholdSettings = [
  {
    id: 'th_load',
    company_id: 'cmp_1',
    indicator: 'load',
    threshold: 0.85,
    comparison: 'gt',
    updated_at: '2026-11-01T08:00:00Z',
  },
  {
    id: 'th_oee',
    company_id: 'cmp_1',
    indicator: 'oee',
    threshold: 0.7,
    comparison: 'lt',
    updated_at: '2026-11-01T08:00:00Z',
  },
  {
    id: 'th_downtime',
    company_id: 'cmp_1',
    indicator: 'downtime',
    threshold: 120,
    comparison: 'gt',
    updated_at: '2026-11-01T08:00:00Z',
  },
  {
    id: 'th_fulfillment',
    company_id: 'cmp_1',
    indicator: 'fulfillment',
    threshold: 0.9,
    comparison: 'lt',
    updated_at: '2026-11-01T08:00:00Z',
  },
];

const ACTIONS = [
  'view_plant_panel',
  'set_threshold',
  'change_priority',
  'cancel_order',
  'export_report',
];

const ALLOWED = {
  plant_manager: ACTIONS,
  supervisor: ['view_plant_panel', 'change_priority', 'cancel_order', 'export_report'],
  planner: ['view_plant_panel', 'change_priority', 'export_report'],
  operator: ['view_plant_panel'],
};

export const rolePermissions = Object.entries(ALLOWED).flatMap(([role, actions]) =>
  ACTIONS.map((action) => ({
    id: `rp_${role}_${action}`,
    company_id: 'cmp_1',
    role,
    action,
    allowed: actions.includes(action),
    updated_at: '2026-11-01T08:00:00Z',
  })),
);
