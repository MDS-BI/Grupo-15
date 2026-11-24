import { describe, it, expect } from 'vitest';
import {
  CANONICAL_ROLES,
  isModuleAllowedForRoles,
  modulesForRoles,
  roleChangeMessage,
  roleLabel,
  rolesForUsername,
  visibleEmployeeNamesFor,
  visibleTechnicianNamesFor,
} from '../../src/domain/role-access.js';
import { ROLE_USERS } from '../../src/data/fixtures/demo-accounts.js';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}

describe('Acceso por roles canónicos', () => {
  it('expone exactamente cinco roles', () => {
    expect(CANONICAL_ROLES).toEqual([
      'plant_manager',
      'supervisor',
      'planner',
      'operator',
      'maintenance',
    ]);
  });

  it('resuelve todos los roles asignados a cada usuario', () => {
    expect(rolesForUsername(ROLE_USERS, 'jefa')).toEqual(['plant_manager']);
    expect(rolesForUsername(ROLE_USERS, 'supervisor')).toEqual(['supervisor']);
    expect(rolesForUsername(ROLE_USERS, 'planificador')).toEqual(['planner']);
    expect(rolesForUsername(ROLE_USERS, 'operador')).toEqual(['operator']);
    expect(rolesForUsername(ROLE_USERS, 'mantenimiento')).toEqual(['maintenance']);
    expect(rolesForUsername(ROLE_USERS, 'test')).toEqual(CANONICAL_ROLES);
    expect(rolesForUsername(ROLE_USERS, 'doble')).toEqual(['operator', 'maintenance']);
    expect(rolesForUsername(ROLE_USERS, 'usuario')).toEqual([]);
    expect(rolesForUsername(ROLE_USERS, '  TEST  ')).toEqual(CANONICAL_ROLES);
  });

  it('consolida módulos y permisos para varios roles', () => {
    expect(modulesForRoles(['operator', 'maintenance'])).toEqual([
      'operator',
      'scheduling',
      'roles',
      'maintenance',
    ]);
    expect(isModuleAllowedForRoles(['operator', 'maintenance'], 'scheduling')).toBe(true);
    expect(isModuleAllowedForRoles(['operator', 'maintenance'], 'admin-roles')).toBe(false);
    expect(isModuleAllowedForRoles(['plant_manager'], 'admin-roles')).toBe(true);
  });

  it('aplica privacidad de nombres según el rol', () => {
    expect(visibleEmployeeNamesFor('supervisor')).toBe(true);
    expect(visibleEmployeeNamesFor('plant_manager')).toBe(true);
    expect(visibleEmployeeNamesFor('operator')).toBe(false);
    expect(visibleTechnicianNamesFor('maintenance')).toBe(true);
    expect(visibleTechnicianNamesFor('plant_manager')).toBe(true);
    expect(visibleTechnicianNamesFor('supervisor')).toBe(false);
    expect(roleLabel('maintenance')).toBe('Encargado de Mantenimiento');
  });
});

describe('Store de administración de roles', () => {
  it('resuelve roles y tablas desde el store', () => {
    const store = new ManufacturingStore({ storage: memoryStorage(), hydrate: false });
    expect(store.roleUsersFor('maintenance')).toHaveLength(3);
    expect(store.rolesForUsername('test')).toEqual(CANONICAL_ROLES);
    expect(store.rolesForUsername('doble')).toEqual(['operator', 'maintenance']);
    expect(store.rolesForUsername('jefa')).toEqual(['plant_manager']);
    expect(store.rolesForUsername('usuario')).toEqual([]);
  });

  it('compone el mensaje exacto de cambio de rol', () => {
    expect(roleChangeMessage('plant_manager')).toBe(
      '¿Deseas cambiar tu vista al rol Jefa de Planta?',
    );
    expect(roleChangeMessage('operator')).toBe(
      '¿Deseas cambiar tu vista al rol Operador de Máquina?',
    );
    expect(roleChangeMessage('maintenance')).toBe(
      '¿Deseas cambiar tu vista al rol Encargado de Mantenimiento?',
    );
  });

  it('persiste altas y asignaciones y las restaura con resetDemoData', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage, hydrate: false });

    expect(store.addRoleUser('planner', { username: 'nueva' })).toMatchObject({
      username: 'nueva',
      password: 'nueva',
    });
    expect(store.assignRoleToUser('operador', 'maintenance')).toBe(true);
    expect(store.rolesForUsername('operador')).toEqual(['operator', 'maintenance']);

    const reloaded = new ManufacturingStore({ storage, hydrate: true });
    expect(reloaded.rolesForUsername('nueva')).toEqual(['planner']);
    expect(reloaded.rolesForUsername('operador')).toEqual(['operator', 'maintenance']);

    expect(reloaded.resetDemoData()).toBe(true);
    expect(reloaded.rolesForUsername('nueva')).toEqual([]);
    expect(reloaded.rolesForUsername('operador')).toEqual(['operator']);
  });
});
