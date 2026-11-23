import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER } from '../../src/domain/access-control.js';
import { CANONICAL_ROLES } from '../../src/domain/role-access.js';

const CREDENTIALS = {
  plant_manager: ['jefa', 'jefa'],
  supervisor: ['supervisor', 'supervisor'],
  planner: ['planificador', 'planificador'],
  operator: ['operador', 'operador'],
  maintenance: ['mantenimiento', 'mantenimiento'],
};

let dom;

function submitLogin(username, password) {
  const form = document.querySelector('[data-role="login-form"]');
  form.elements.username.value = username;
  form.elements.password.value = password;
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}

async function boot() {
  await import('../../src/manufacturing-main.js');
}

async function enter(username, password) {
  submitLogin(username, password);
  await vi.waitFor(() => expect(document.querySelector('.shell')).toBeTruthy());
}

function openUserMenu() {
  document.querySelector('[data-role="user-menu-toggle"]').click();
}

function chooseRole(role) {
  openUserMenu();
  const select = document.querySelector('[data-role="role-select"]');
  select.value = role;
  select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.location = dom.window.location;
  globalThis.history = dom.window.history;
  globalThis.addEventListener = dom.window.addEventListener.bind(dom.window);
  vi.resetModules();
});

afterEach(() => {
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.localStorage;
  delete globalThis.location;
  delete globalThis.history;
  delete globalThis.addEventListener;
});

describe('Ingreso genérico y sistema multi-rol', () => {
  it('muestra un login sin datos de roles', async () => {
    await boot();

    expect(document.querySelector('[data-role="login-form"]')).toBeTruthy();
    expect(document.querySelector('#toast-region').getAttribute('role')).toBe('status');
    expect(document.body.textContent).toContain('Iniciar sesión');
    for (const role of ROLE_ORDER)
      expect(document.body.textContent).not.toContain(ROLE_LABELS[role]);
    for (const description of Object.values(ROLE_DESCRIPTIONS)) {
      expect(document.body.textContent).not.toContain(description);
    }
    expect(document.body.textContent).not.toContain('Entrar como');
  });

  it('muestra un error genérico y no entra con credenciales inválidas', async () => {
    await boot();
    submitLogin('jefa', 'incorrecta');

    const error = document.querySelector('[data-role="login-error"]');

    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe('Usuario o contraseña incorrectos');
    expect(document.querySelector('.shell')).toBeNull();
  });

  it('entra con un rol único y no ofrece selector ni administración', async () => {
    await boot();
    await enter(...CREDENTIALS.operator);

    expect(document.querySelector('[data-module="admin-roles"]')).toBeNull();
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('operador|operator');
    openUserMenu();
    expect(document.querySelector('[data-role="role-select"]')).toBeNull();

    globalThis.location.hash = '#/admin-roles';
    dom.window.dispatchEvent(new dom.window.Event('hashchange'));

    expect(document.querySelector('[data-role="breadcrumb"] strong').textContent).toBe('Estación');
    expect(document.body.textContent).not.toContain('Entrar como');
  });

  it('permite a la Jefa de Planta abrir el panel de cinco tablas', async () => {
    await boot();
    await enter(...CREDENTIALS.plant_manager);

    const adminButton = document.querySelector('[data-module="admin-roles"]');
    expect(adminButton).toBeTruthy();
    adminButton.click();

    expect(document.querySelectorAll('[data-role="admin-user-table"]')).toHaveLength(5);
    expect(document.querySelectorAll('[data-pick-role]')).toHaveLength(0);
    expect(document.body.textContent).toContain('Datos de roles');
    expect(document.body.textContent).toContain('Jefa de Planta');
  });

  it('rechaza la cuenta genérica usuario', async () => {
    await boot();
    submitLogin('usuario', 'usuario');

    expect(document.querySelector('[data-role="login-error"]').hidden).toBe(false);
    expect(document.querySelector('.shell')).toBeNull();
  });

  it('ofrece los cinco roles a test y solo dos a doble', async () => {
    await boot();
    await enter('test', 'test');
    openUserMenu();

    expect(
      Array.from(document.querySelectorAll('[data-role="role-select"] option')).map(
        (option) => option.value,
      ),
    ).toEqual(CANONICAL_ROLES);
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('test|plant_manager');

    document.querySelector('[data-logout]').click();
    await vi.waitFor(() => expect(document.querySelector('[data-role="login-form"]')).toBeTruthy());

    await enter('doble', 'doble');
    openUserMenu();
    expect(
      Array.from(document.querySelectorAll('[data-role="role-select"] option')).map(
        (option) => option.value,
      ),
    ).toEqual(['operator', 'maintenance']);
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('doble|operator');
    expect(document.querySelector('[data-module="admin-roles"]')).toBeNull();
  });

  it('cambia de rol efectivo sin alterar la identidad', async () => {
    await boot();
    await enter('test', 'test');
    chooseRole('operator');

    expect(document.querySelector('[data-role="viewing-as"]').textContent).toContain(
      'Viendo como: Operador de Máquina',
    );
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('test|operator');
    expect(document.querySelector('[data-module="orders"]')).toBeNull();
    expect(document.querySelector('[data-module="scheduling"]')).toBeTruthy();

    chooseRole('plant_manager');

    expect(document.querySelector('[data-role="viewing-as"]')).toBeNull();
    expect(document.querySelector('[data-module="scheduling"]')).toBeTruthy();
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('test|plant_manager');
  });

  it('vuelve al login al cerrar sesión', async () => {
    await boot();
    await enter(...CREDENTIALS.planner);

    openUserMenu();
    document.querySelector('[data-logout]').click();

    expect(document.querySelector('[data-role="login-form"]')).toBeTruthy();
    expect(localStorage.getItem('erp.manufacturing.role')).toBeNull();
  });

  it('no duplica el selector de rol dentro de #/roles', async () => {
    await boot();
    await enter('test', 'test');
    document.querySelector('[data-module="roles"]').click();

    expect(document.querySelectorAll('[data-select-role]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-role="role-select"]')).toHaveLength(0);
    expect(document.body.textContent).toContain('Páginas disponibles');
  });

  it('permite reiniciar la demo solo a la jefa real con su rol', async () => {
    await boot();
    await enter(...CREDENTIALS.plant_manager);

    openUserMenu();
    const resetButton = document.querySelector('[data-reset-demo]');
    expect(resetButton).toBeTruthy();

    resetButton.click();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="confirm-dialog"]')).toBeTruthy(),
    );
    document.querySelector('[data-role="confirm"]').click();

    await vi.waitFor(() =>
      expect(document.querySelector('[data-role="confirm-dialog"]')).toBeNull(),
    );
    expect(document.querySelector('[data-role="login-form"]')).toBeNull();
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('jefa|plant_manager');
    expect(document.body.textContent).toContain('Datos de demo reiniciados');
  });

  it('oculta el reinicio de la demo a otros roles y mientras se visualiza otro rol', async () => {
    await boot();
    await enter(...CREDENTIALS.operator);
    openUserMenu();
    expect(document.querySelector('[data-reset-demo]')).toBeNull();

    document.querySelector('[data-logout]').click();
    await vi.waitFor(() => expect(document.querySelector('[data-role="login-form"]')).toBeTruthy());

    await enter('test', 'test');
    chooseRole('operator');
    openUserMenu();
    expect(document.querySelector('[data-reset-demo]')).toBeNull();
  });
});
