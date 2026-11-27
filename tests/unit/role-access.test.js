import { describe, it, expect } from 'vitest';
import { MODULE_ACCESS, isModuleAllowed } from '../../src/domain/access-control.js';
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
import { DEMO_ACCOUNTS, ROLE_USERS } from '../../src/data/fixtures/demo-accounts.js';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';

const ACCOUNT_ROLES = {
  'jefa.planta': 'plant_manager',
  'planificador.ops': 'planner',
  'ingeniero.prod': 'production_engineer',
  'supervisor.linea': 'supervisor',
  'operador.planta': 'operator',
  'mantencion.mgr': 'maintenance',
};

const ALL_MODULES = Object.keys(MODULE_ACCESS);

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
  it('expone exactamente seis roles canónicos', () => {
    expect(new Set(CANONICAL_ROLES)).toEqual(new Set(Object.values(ACCOUNT_ROLES)));
    expect(CANONICAL_ROLES).toHaveLength(6);
    expect(CANONICAL_ROLES).toContain('production_engineer');
  });

  it('resuelve un único rol por cuenta demo y rechaza cuentas heredadas', () => {
    expect(DEMO_ACCOUNTS).toHaveLength(6);
    for (const [username, role] of Object.entries(ACCOUNT_ROLES)) {
      expect(rolesForUsername(ROLE_USERS, username)).toEqual([role]);
      expect(rolesForUsername(ROLE_USERS, username.toUpperCase())).toEqual([role]);
    }
    for (const legacy of ['usuario', 'test', 'doble']) {
      expect(rolesForUsername(ROLE_USERS, legacy)).toEqual([]);
    }
    expect(rolesForUsername(ROLE_USERS, '')).toEqual([]);
    expect(rolesForUsername(ROLE_USERS, 'desconocido')).toEqual([]);
  });

  it('consolida módulos y permisos de forma consistente con MODULE_ACCESS', () => {
    for (const role of CANONICAL_ROLES) {
      const expected = ALL_MODULES.filter((moduleId) => isModuleAllowed(role, moduleId));
      expect([...modulesForRoles([role])].sort()).toEqual([...expected].sort());
      for (const moduleId of ALL_MODULES) {
        expect(isModuleAllowedForRoles([role], moduleId)).toBe(isModuleAllowed(role, moduleId));
      }
    }
    const union = CANONICAL_ROLES.flatMap((role) =>
      ALL_MODULES.filter((moduleId) => isModuleAllowed(role, moduleId)),
    );
    expect([...modulesForRoles(CANONICAL_ROLES)].sort()).toEqual([...new Set(union)].sort());
    expect(isModuleAllowedForRoles([], 'roles')).toBe(false);
  });

  it('usa las etiquetas canónicas y el mensaje de ver como', () => {
    expect(roleLabel('operator')).toBe('Operador');
    expect(roleLabel('supervisor')).toBe('Supervisor de Línea');
    expect(roleLabel('production_engineer')).toBe('Ingeniero de Producción');
    expect(roleChangeMessage('production_engineer')).toContain('Ingeniero de Producción');
    expect(roleChangeMessage('production_engineer')).toMatch(/^¿Deseas/);
    expect(roleChangeMessage('operator')).toContain('Operador');
    expect(roleChangeMessage('operator')).not.toContain('Operador de Máquina');
  });

  it('aplica privacidad de nombres según el rol', () => {
    expect(visibleEmployeeNamesFor('supervisor')).toBe(true);
    expect(visibleEmployeeNamesFor('plant_manager')).toBe(true);
    expect(visibleEmployeeNamesFor('production_engineer')).toBe(false);
    expect(visibleEmployeeNamesFor('operator')).toBe(false);
    expect(visibleTechnicianNamesFor('maintenance')).toBe(true);
    expect(visibleTechnicianNamesFor('plant_manager')).toBe(true);
    expect(visibleTechnicianNamesFor('supervisor')).toBe(false);
  });
});

describe('Store de administración de roles', () => {
  it('resuelve la sexta tabla y una sola fila por cuenta demo', () => {
    const store = new ManufacturingStore({ storage: memoryStorage(), hydrate: false });
    expect(store.roleUsersFor('production_engineer').map((row) => row.username)).toEqual([
      'ingeniero.prod',
    ]);
    for (const [username, role] of Object.entries(ACCOUNT_ROLES)) {
      expect(store.rolesForUsername(username)).toEqual([role]);
    }
    for (const legacy of ['usuario', 'test', 'doble']) {
      expect(store.rolesForUsername(legacy)).toEqual([]);
    }
  });

  it('persiste altas de un solo rol y las restaura con resetDemoData', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage, hydrate: false });
    store.setSessionRole('plant_manager', 'plant_manager');

    expect(store.addRoleUser('planner', { username: '  Nueva  ' })).toMatchObject({
      username: 'nueva',
      password: 'nueva',
    });
    expect(store.rolesForUsername('nueva')).toEqual(['planner']);

    const reloaded = new ManufacturingStore({ storage, hydrate: true });
    expect(reloaded.rolesForUsername('nueva')).toEqual(['planner']);
    expect(reloaded.resetDemoData()).toBe(true);
    expect(reloaded.rolesForUsername('nueva')).toEqual([]);
  });
});
