import { describe, it, expect } from 'vitest';
import {
  DEMO_ACCOUNTS,
  ROLE_USERS,
  ROLE_USER_COLLECTION_KEYS,
  authenticate,
} from '../../src/data/fixtures/demo-accounts.js';
import { CANONICAL_ROLES } from '../../src/domain/role-access.js';

const EXPECTED_ACCOUNTS = [
  { username: 'jefa.planta', password: 'ForjaPlanta26!', role: 'plant_manager' },
  { username: 'planificador.ops', password: 'Calendario2026!', role: 'planner' },
  { username: 'ingeniero.prod', password: 'RutaOptimal26!', role: 'production_engineer' },
  { username: 'supervisor.linea', password: 'TurnoLinea26!', role: 'supervisor' },
  { username: 'operador.planta', password: 'Estacion2026!', role: 'operator' },
  { username: 'mantencion.mgr', password: 'TallerMaq26!', role: 'maintenance' },
];

const EXPECTED_TABLES = {
  plant_manager: 'role_users_plant_manager',
  planner: 'role_users_planner',
  production_engineer: 'role_users_production_engineer',
  supervisor: 'role_users_supervisor',
  operator: 'role_users_operator',
  maintenance: 'role_users_maintenance',
};

function accountRoles(account) {
  const value = account.roles ?? account.role;
  return Array.isArray(value) ? value : [value];
}

function authRoles(result) {
  if (!result) return [];
  const value = result.roles ?? result.role ?? result;
  return Array.isArray(value) ? value : [value];
}

describe('Cuentas de demostración por rol', () => {
  it('define exactamente seis cuentas con credenciales literales', () => {
    expect(DEMO_ACCOUNTS).toHaveLength(6);
    for (const expected of EXPECTED_ACCOUNTS) {
      const account = DEMO_ACCOUNTS.find((entry) => entry.username === expected.username);
      expect(account).toBeTruthy();
      expect(account.password).toBe(expected.password);
      expect(accountRoles(account)).toEqual([expected.role]);
    }
    expect(new Set(DEMO_ACCOUNTS.map((entry) => entry.username))).toEqual(
      new Set(EXPECTED_ACCOUNTS.map((entry) => entry.username)),
    );
  });

  it('distribuye una sola fila por cuenta en su tabla de rol', () => {
    expect(Object.keys(ROLE_USER_COLLECTION_KEYS).sort()).toEqual([...CANONICAL_ROLES].sort());
    expect(ROLE_USER_COLLECTION_KEYS).toEqual(EXPECTED_TABLES);
    expect(Object.keys(ROLE_USERS).sort()).toEqual(Object.keys(EXPECTED_TABLES).sort());

    const allUsernames = [];
    for (const expected of EXPECTED_ACCOUNTS) {
      const rows = ROLE_USERS[expected.role];
      expect(rows).toHaveLength(1);
      expect(rows[0].username).toBe(expected.username);
      expect(rows[0].password).toBe(expected.password);
      expect(rows[0].id).toBeTruthy();
      expect(rows[0].company_id).toBe('cmp_1');
      expect(rows[0].created_at).toBeTruthy();
      allUsernames.push(rows[0].username);
    }
    expect(new Set(allUsernames).size).toBe(EXPECTED_ACCOUNTS.length);
    expect(
      Object.values(ROLE_USERS)
        .flat()
        .map((row) => row.username)
        .sort(),
    ).toEqual(EXPECTED_ACCOUNTS.map((entry) => entry.username).sort());
  });

  it('autentica cada cuenta con su contraseña literal y un único rol', () => {
    for (const expected of EXPECTED_ACCOUNTS) {
      expect(authRoles(authenticate(expected.username, expected.password))).toEqual([
        expected.role,
      ]);
    }
    for (const expected of EXPECTED_ACCOUNTS) {
      expect(authenticate(expected.username, expected.username)).toBeNull();
      expect(authenticate(expected.username.toUpperCase(), 'incorrecta')).toBeNull();
    }
  });

  it('rechaza cuentas genéricas, de prueba y credenciales inválidas', () => {
    for (const legacy of ['usuario', 'test', 'doble']) {
      expect(authenticate(legacy, legacy)).toBeNull();
    }
    expect(authenticate('jefa.planta', 'forjaplanta26!')).toBeNull();
    expect(authenticate('ingeniero.prod', 'RutaOptimal26')).toBeNull();
    expect(authenticate('desconocido', 'desconocido')).toBeNull();
    expect(authenticate('', '')).toBeNull();
    expect(authenticate(null, null)).toBeNull();
  });

  it('lee la credencial actualizada desde las tablas entregadas', () => {
    const changed = JSON.parse(JSON.stringify(ROLE_USERS));
    changed.production_engineer[0].password = 'ClaveIngeniero123';

    expect(authenticate('ingeniero.prod', 'RutaOptimal26!', changed)).toBeNull();
    expect(authRoles(authenticate('ingeniero.prod', 'ClaveIngeniero123', changed))).toEqual([
      'production_engineer',
    ]);
    expect(authRoles(authenticate('jefa.planta', 'ForjaPlanta26!', changed))).toEqual([
      'plant_manager',
    ]);
    expect(ROLE_USERS.production_engineer[0].password).toBe('RutaOptimal26!');
  });
});
