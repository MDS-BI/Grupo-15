import { describe, it, expect } from 'vitest';
import { DEMO_ACCOUNTS, ROLE_USERS, authenticate } from '../../src/data/fixtures/demo-accounts.js';
import { CANONICAL_ROLES } from '../../src/domain/role-access.js';

describe('Cuentas de demostración por rol', () => {
  it('define cinco tablas con las credenciales canónicas', () => {
    expect(Object.keys(ROLE_USERS)).toEqual(CANONICAL_ROLES);
    const usernames = Object.values(ROLE_USERS)
      .flat()
      .map((row) => row.username);
    expect(new Set(usernames)).toEqual(
      new Set(['jefa', 'supervisor', 'planificador', 'operador', 'mantenimiento', 'test', 'doble']),
    );
    for (const rows of Object.values(ROLE_USERS)) {
      for (const row of rows) {
        expect(row.password).toBe(row.username);
        expect(row.company_id).toBe('cmp_1');
        expect(row.id).toBeTruthy();
        expect(row.created_at).toBeTruthy();
      }
    }
  });

  it('expone cuentas únicas con su conjunto de roles', () => {
    expect(DEMO_ACCOUNTS.find((account) => account.username === 'test').roles).toEqual(
      CANONICAL_ROLES,
    );
    expect(DEMO_ACCOUNTS.find((account) => account.username === 'doble').roles).toEqual([
      'operator',
      'maintenance',
    ]);
    expect(new Set(DEMO_ACCOUNTS.map((account) => account.username)).size).toBe(
      DEMO_ACCOUNTS.length,
    );
  });

  it('autentica con contraseña igual al usuario y devuelve todos los roles', () => {
    expect(authenticate('jefa', 'jefa')).toEqual(['plant_manager']);
    expect(authenticate('supervisor', 'supervisor')).toEqual(['supervisor']);
    expect(authenticate('planificador', 'planificador')).toEqual(['planner']);
    expect(authenticate('operador', 'operador')).toEqual(['operator']);
    expect(authenticate('mantenimiento', 'mantenimiento')).toEqual(['maintenance']);
    expect(authenticate('test', 'test')).toEqual(CANONICAL_ROLES);
    expect(authenticate('doble', 'doble')).toEqual(['operator', 'maintenance']);
    expect(authenticate('  TEST  ', 'test')).toEqual(CANONICAL_ROLES);
  });

  it('authenticate lee la credencial cambiada desde las tablas entregadas', () => {
    const changed = Object.fromEntries(
      Object.entries(ROLE_USERS).map(([role, rows]) => [
        role,
        rows.map((row) => (row.username === 'test' ? { ...row, password: 'clave-cambiada' } : row)),
      ]),
    );

    expect(authenticate('test', 'test', changed)).toBeNull();
    expect(authenticate('test', 'clave-cambiada', changed)).toEqual(CANONICAL_ROLES);
    expect(authenticate('jefa', 'jefa', changed)).toEqual(['plant_manager']);
    expect(ROLE_USERS.plant_manager.find((row) => row.username === 'jefa').password).toBe('jefa');
  });

  it('niega la cuenta genérica y credenciales inválidas', () => {
    expect(authenticate('usuario', 'usuario')).toBeNull();
    expect(authenticate('jefa', 'incorrecta')).toBeNull();
    expect(authenticate('jefa.planta', 'Pl4nta2026')).toBeNull();
    expect(authenticate('desconocido', 'desconocido')).toBeNull();
    expect(authenticate('', '')).toBeNull();
    expect(authenticate(null, null)).toBeNull();
  });
});
