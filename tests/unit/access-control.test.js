import { describe, it, expect } from 'vitest';
import {
  MODULE_ACCESS,
  MODULE_GROUPS,
  ROLE_ORDER,
  USER_ROLES,
  isAdmin,
  isModuleAllowed,
  modulesForRole,
} from '../../src/domain/access-control.js';

const ALL_MODULES = MODULE_GROUPS.flatMap((group) => group.modules);

describe('Control de acceso administrativo', () => {
  it('reconoce cinco roles canónicos y solo el administrador ve admin-roles', () => {
    expect(USER_ROLES.MAINTENANCE).toBe('maintenance');
    expect(ROLE_ORDER).toEqual([
      'operator',
      'supervisor',
      'planner',
      'plant_manager',
      'maintenance',
    ]);
    expect(MODULE_ACCESS['admin-roles']).toEqual([USER_ROLES.PLANT_MANAGER]);
    expect(isModuleAllowed(USER_ROLES.PLANT_MANAGER, 'admin-roles')).toBe(true);
    for (const role of ROLE_ORDER.filter((entry) => !isAdmin(entry))) {
      expect(isModuleAllowed(role, 'admin-roles')).toBe(false);
    }
  });

  it('aplica la matriz exacta de AC-51', () => {
    expect(modulesForRole(USER_ROLES.SUPERVISOR, ALL_MODULES)).not.toContain('orders');
    expect(modulesForRole(USER_ROLES.OPERATOR, ALL_MODULES)).toEqual([
      'operator',
      'scheduling',
      'roles',
    ]);
    expect(modulesForRole(USER_ROLES.MAINTENANCE, ALL_MODULES)).toEqual([
      'maintenance',
      'scheduling',
    ]);
    expect(modulesForRole(USER_ROLES.PLANNER, ALL_MODULES).sort()).toEqual(
      ['dashboard', 'bom', 'orders', 'plant', 'scheduling', 'line-balance', 'roles'].sort(),
    );
    expect(isModuleAllowed(USER_ROLES.OPERATOR, 'dashboard')).toBe(false);
    expect(isModuleAllowed(USER_ROLES.MAINTENANCE, 'plant')).toBe(false);
    expect(isModuleAllowed('desconocido', 'dashboard')).toBe(true);
    expect(isModuleAllowed(USER_ROLES.PLANT_MANAGER, 'modulo-inexistente')).toBe(false);
    expect(MODULE_ACCESS.roles).toEqual(ROLE_ORDER.filter((role) => role !== 'maintenance'));
  });
});
