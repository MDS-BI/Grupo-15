import { describe, it, expect } from 'vitest';
import {
  ACTION_ACCESS,
  MODULE_ACCESS,
  MODULE_GROUPS,
  ROLE_HOME_MODULE,
  ROLE_LABELS,
  ROLE_ORDER,
  USER_ROLES,
  can,
  homeModuleForRole,
  isAdmin,
  isModuleAllowed,
  modulesForRole,
} from '../../src/domain/access-control.js';

const ALL_ROLES = [
  'plant_manager',
  'planner',
  'production_engineer',
  'supervisor',
  'operator',
  'maintenance',
];

const PUBLIC_MODULES = [
  'dashboard',
  'orders',
  'operator',
  'supervision',
  'plant',
  'scheduling',
  'line-balance',
  'maintenance',
  'bom',
  'roles',
];

const EXPECTED_MODULES = {
  plant_manager: PUBLIC_MODULES,
  planner: ['dashboard', 'bom', 'orders', 'scheduling', 'plant', 'line-balance'],
  production_engineer: ['dashboard', 'bom', 'line-balance', 'plant'],
  supervisor: ['dashboard', 'operator', 'supervision', 'scheduling', 'maintenance', 'plant'],
  operator: ['operator', 'scheduling'],
  maintenance: ['maintenance', 'scheduling'],
};

const EXPECTED_CAN = {
  'panel.ver': ALL_ROLES,
  'panel.crear': ['plant_manager'],
  'panel.editar': ['plant_manager'],
  'panel.aprobar': [],
  'panel.exportar': ['plant_manager', 'planner', 'production_engineer', 'supervisor'],
  'panel.configurar': ['plant_manager'],
  'bom.ver': ['plant_manager', 'planner', 'production_engineer', 'supervisor', 'operator'],
  'bom.crear': ['plant_manager', 'production_engineer'],
  'bom.editar': ['plant_manager', 'production_engineer'],
  'bom.aprobar': ['plant_manager'],
  'bom.exportar': ['plant_manager', 'planner', 'production_engineer'],
  'bom.configurar': [],
  'orders.ver': ['plant_manager', 'planner', 'production_engineer', 'supervisor'],
  'orders.crear': ['plant_manager', 'planner'],
  'orders.editar': ['plant_manager', 'planner'],
  'orders.aprobar': ['plant_manager', 'planner'],
  'orders.exportar': ['plant_manager', 'planner', 'production_engineer'],
  'orders.configurar': [],
  'estacion.ver': ['plant_manager', 'supervisor', 'operator'],
  'estacion.crear': ['plant_manager', 'supervisor', 'operator'],
  'estacion.editar': ['plant_manager', 'supervisor', 'operator'],
  'estacion.aprobar': ['plant_manager', 'supervisor'],
  'estacion.exportar': [],
  'estacion.configurar': [],
  'supervision.ver': ['plant_manager', 'supervisor'],
  'supervision.crear': ['plant_manager', 'supervisor'],
  'supervision.editar': ['plant_manager', 'supervisor'],
  'supervision.aprobar': ['plant_manager', 'supervisor'],
  'supervision.exportar': ['plant_manager'],
  'supervision.configurar': [],
  'planificacion.ver': ALL_ROLES,
  'planificacion.crear': ['plant_manager', 'planner'],
  'planificacion.editar': ['plant_manager', 'planner'],
  'planificacion.aprobar': ['plant_manager', 'maintenance'],
  'planificacion.exportar': ['plant_manager', 'planner'],
  'planificacion.configurar': [],
  'balance.ver': ['plant_manager', 'planner', 'production_engineer', 'supervisor'],
  'balance.crear': ['plant_manager', 'production_engineer'],
  'balance.editar': ['plant_manager', 'production_engineer'],
  'balance.aprobar': [],
  'balance.exportar': ['plant_manager', 'production_engineer'],
  'balance.configurar': [],
  'mantenimiento.ver': ['plant_manager', 'supervisor', 'operator', 'maintenance'],
  'mantenimiento.crear': ['plant_manager', 'supervisor', 'operator', 'maintenance'],
  'mantenimiento.editar': ['plant_manager', 'maintenance'],
  'mantenimiento.aprobar': ['plant_manager', 'maintenance'],
  'mantenimiento.exportar': ['plant_manager', 'maintenance'],
  'mantenimiento.configurar': [],
  'roles.ver': ['plant_manager'],
  'roles.crear': ['plant_manager'],
  'roles.editar': ['plant_manager'],
  'roles.aprobar': ['plant_manager'],
  'roles.exportar': ['plant_manager'],
  'roles.configurar': ['plant_manager'],
};

describe('Control de acceso por rol y módulo', () => {
  it('reconoce seis roles canónicos y etiquetas vigentes', () => {
    expect(new Set(Object.values(USER_ROLES))).toEqual(new Set(ALL_ROLES));
    expect(ROLE_ORDER).toHaveLength(ALL_ROLES.length);
    expect(new Set(ROLE_ORDER)).toEqual(new Set(ALL_ROLES));
    expect(ROLE_LABELS.operator).toBe('Operador');
    expect(ROLE_LABELS.production_engineer).toBe('Ingeniero de Producción');
    expect(ROLE_LABELS.supervisor).toBe('Supervisor de Línea');
    expect(isAdmin('plant_manager')).toBe(true);
    expect(ALL_ROLES.filter((role) => isAdmin(role))).toEqual(['plant_manager']);
  });

  it('fija el módulo de inicio de cada cuenta', () => {
    expect(ROLE_HOME_MODULE).toMatchObject({
      plant_manager: 'plant',
      planner: 'scheduling',
      production_engineer: 'line-balance',
      supervisor: 'supervision',
      operator: 'operator',
      maintenance: 'maintenance',
    });
    for (const role of ALL_ROLES) {
      expect(homeModuleForRole(role)).toBe(ROLE_HOME_MODULE[role]);
    }
  });

  it('aplica la matriz de módulos de FR-14/FR-22', () => {
    for (const moduleId of PUBLIC_MODULES) {
      expect(Object.keys(MODULE_ACCESS)).toContain(moduleId);
    }
    for (const role of ALL_ROLES) {
      const allowed = PUBLIC_MODULES.filter((moduleId) => isModuleAllowed(role, moduleId));
      expect(allowed.sort()).toEqual([...EXPECTED_MODULES[role]].sort());
      expect(
        modulesForRole(
          role,
          MODULE_GROUPS.flatMap((group) => group.modules),
        )
          .map((module) => (typeof module === 'string' ? module : module.id))
          .sort(),
      ).toEqual(allowed.sort());
    }
    expect(isModuleAllowed('plant_manager', 'admin-roles')).toBe(true);
    for (const role of ALL_ROLES.filter((entry) => entry !== 'plant_manager')) {
      expect(isModuleAllowed(role, 'admin-roles')).toBe(false);
      expect(isModuleAllowed(role, 'roles')).toBe(false);
    }
    expect(isModuleAllowed('plant_manager', 'modulo-inexistente')).toBe(false);
  });

  it('congela ACTION_ACCESS y cumple la matriz de acciones para los seis roles', () => {
    expect(Object.isFrozen(ACTION_ACCESS)).toBe(true);
    for (const [actionKey, expectedRoles] of Object.entries(EXPECTED_CAN)) {
      expect(can('plant_manager', actionKey)).toBe(expectedRoles.includes('plant_manager'));
      for (const role of ALL_ROLES) {
        expect(can(role, actionKey)).toBe(expectedRoles.includes(role));
        const stored = ACTION_ACCESS[actionKey];
        if (stored) expect(stored.includes(role)).toBe(expectedRoles.includes(role));
      }
    }
  });

  it('deniega acciones prohibidas para todos los roles', () => {
    const forbidden = [
      'panel.aprobar',
      'bom.configurar',
      'orders.configurar',
      'estacion.exportar',
      'supervision.configurar',
      'planificacion.configurar',
      'balance.aprobar',
      'mantenimiento.configurar',
    ];
    for (const actionKey of forbidden) {
      for (const role of ALL_ROLES) {
        expect(can(role, actionKey)).toBe(false);
      }
    }
    for (const role of ALL_ROLES) {
      expect(can(role, 'accion.inexistente')).toBe(false);
      expect(can('desconocido', 'panel.ver')).toBe(false);
    }
  });

  it('acepta los alias de módulos de la interfaz', () => {
    const aliases = [
      ['dashboard.ver', 'panel.ver', 'operator'],
      ['plant.exportar', 'panel.exportar', 'maintenance'],
      ['operator.crear', 'estacion.crear', 'operator'],
      ['scheduling.editar', 'planificacion.editar', 'production_engineer'],
      ['line-balance.editar', 'balance.editar', 'production_engineer'],
      ['maintenance.aprobar', 'mantenimiento.aprobar', 'maintenance'],
      ['maintenance.aprobar', 'mantenimiento.aprobar', 'operator'],
    ];
    for (const [aliasKey, canonicalKey, role] of aliases) {
      expect(can(role, aliasKey)).toBe(can(role, canonicalKey));
    }
  });
});
