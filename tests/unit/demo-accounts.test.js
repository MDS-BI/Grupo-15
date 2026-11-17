import { describe, it, expect } from 'vitest';
import { DEMO_ACCOUNTS, authenticate } from '../../src/data/fixtures/demo-accounts.js';
import { ROLE_ORDER, USER_ROLES, isAdmin } from '../../src/domain/access-control.js';

describe('Cuentas de demostración', () => {
  it('cubre todos los roles simulados con usuarios únicos', () => {
    expect(new Set(DEMO_ACCOUNTS.map((account) => account.role))).toEqual(new Set(ROLE_ORDER));
    expect(new Set(DEMO_ACCOUNTS.map((account) => account.username)).size).toBe(
      DEMO_ACCOUNTS.length,
    );
    for (const account of DEMO_ACCOUNTS) {
      expect(account.username).toBeTruthy();
      expect(account.password).toBeTruthy();
    }
  });

  it('devuelve el rol con credenciales válidas y normaliza el usuario', () => {
    for (const account of DEMO_ACCOUNTS) {
      expect(authenticate(account.username, account.password)).toBe(account.role);
      expect(authenticate(`  ${account.username.toUpperCase()}  `, account.password)).toBe(
        account.role,
      );
    }
  });

  it('deniega credenciales inválidas o incompletas', () => {
    expect(authenticate('jefa.planta', 'incorrecta')).toBeNull();
    expect(authenticate('desconocido', 'Pl4nta2026')).toBeNull();
    expect(authenticate('', '')).toBeNull();
    expect(authenticate(null, null)).toBeNull();
  });

  it('autentica la cuenta administrativa usuario', () => {
    const role = authenticate('usuario', 'usuario');
    expect(role).toBe(USER_ROLES.PLANT_MANAGER);
    expect(isAdmin(role)).toBe(true);
  });

  it('reserva los datos de roles para la Jefa de Planta', () => {
    expect(isAdmin(USER_ROLES.PLANT_MANAGER)).toBe(true);
    expect(isAdmin(USER_ROLES.OPERATOR)).toBe(false);
    expect(isAdmin(USER_ROLES.SUPERVISOR)).toBe(false);
    expect(isAdmin(USER_ROLES.PLANNER)).toBe(false);
  });
});
