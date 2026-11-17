import { describe, it, expect } from 'vitest';
import {
  MODULE_ACCESS,
  ROLE_ORDER,
  USER_ROLES,
  isAdmin,
  isModuleAllowed,
} from '../../src/domain/access-control.js';

describe('Control de acceso administrativo', () => {
  it('solo expone los datos de roles al administrador', () => {
    expect(MODULE_ACCESS['admin-roles']).toEqual([USER_ROLES.PLANT_MANAGER]);
    expect(isModuleAllowed(USER_ROLES.PLANT_MANAGER, 'admin-roles')).toBe(true);
    for (const role of ROLE_ORDER.filter((entry) => !isAdmin(entry))) {
      expect(isModuleAllowed(role, 'admin-roles')).toBe(false);
    }
  });

  it('mantiene sin cambios el acceso al resto de módulos', () => {
    expect(isModuleAllowed(USER_ROLES.OPERATOR, 'operator')).toBe(true);
    expect(isModuleAllowed(USER_ROLES.OPERATOR, 'scheduling')).toBe(false);
    expect(isModuleAllowed(USER_ROLES.PLANNER, 'bom')).toBe(true);
    expect(isModuleAllowed('desconocido', 'dashboard')).toBe(true);
    expect(isModuleAllowed(USER_ROLES.PLANT_MANAGER, 'modulo-inexistente')).toBe(false);
  });
});
