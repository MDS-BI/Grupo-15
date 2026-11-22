import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER } from '../../src/domain/access-control.js';
import { DEMO_ACCOUNTS } from '../../src/data/fixtures/demo-accounts.js';

let dom;

function accountFor(role) {
  return DEMO_ACCOUNTS.find((account) => account.role === role);
}

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

describe('Ingreso genérico y roles de administrador', () => {
  it('muestra un login sin datos de roles', async () => {
    await boot();

    expect(document.querySelector('[data-role="login-form"]')).toBeTruthy();
    expect(document.querySelector('#toast-region')).toBeTruthy();
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
    submitLogin('jefa.planta', 'incorrecta');

    const error = document.querySelector('[data-role="login-error"]');

    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe('Usuario o contraseña incorrectos');
    expect(document.querySelector('[data-role="login-form"]')).toBeTruthy();
    expect(document.querySelector('.shell')).toBeNull();
  });

  it('entra con credenciales válidas y oculta los datos de roles al no administrador', async () => {
    await boot();
    const account = accountFor('operator');
    await enter(account.username, account.password);

    expect(document.querySelector('.shell')).toBeTruthy();
    expect(document.querySelector('[data-module="admin-roles"]')).toBeNull();
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('operator|operator');

    globalThis.location.hash = '#/admin-roles';
    dom.window.dispatchEvent(new dom.window.Event('hashchange'));

    expect(document.querySelector('[data-module="admin-roles"]')).toBeNull();
    expect(document.querySelector('[data-role="breadcrumb"] strong').textContent).toBe('Estación');
    expect(document.body.textContent).not.toContain('Entrar como');
  });

  it('permite a la Jefa de Planta consultar los datos de roles', async () => {
    await boot();
    const account = accountFor('plant_manager');
    await enter(account.username, account.password);

    const adminButton = document.querySelector('[data-module="admin-roles"]');
    expect(adminButton).toBeTruthy();
    adminButton.click();

    expect(document.querySelectorAll('[data-pick-role]')).toHaveLength(ROLE_ORDER.length);
    expect(document.body.textContent).toContain(ROLE_DESCRIPTIONS.operator);
    expect(document.body.textContent).toContain('Entrar como');
  });

  it('entra con la cuenta usuario y obtiene permisos de administrador', async () => {
    await boot();
    await enter('usuario', 'usuario');

    expect(document.querySelector('[data-role="login-form"]')).toBeNull();
    expect(document.querySelector('[data-module="admin-roles"]')).toBeTruthy();
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('plant_manager|plant_manager');
  });

  it('vuelve al login al cerrar sesión', async () => {
    await boot();
    const account = accountFor('planner');
    await enter(account.username, account.password);

    document.querySelector('[data-role="user-menu-toggle"]').click();
    document.querySelector('[data-logout]').click();

    expect(document.querySelector('[data-role="login-form"]')).toBeTruthy();
    expect(localStorage.getItem('erp.manufacturing.role')).toBeNull();
  });

  it('permite a la Jefa de Planta ver como otro rol y volver sin cambiar el rol real', async () => {
    await boot();
    await enter('jefa.planta', 'Pl4nta2026');

    document.querySelector('[data-role="user-menu-toggle"]').click();
    const select = document.querySelector('[data-role="role-select"]');
    select.value = 'operator';
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(document.querySelector('[data-role="viewing-as"]').textContent).toContain(
      'Viendo como: Operador de Máquina',
    );
    expect(document.querySelector('[data-role="user-menu-toggle"]')).toBeTruthy();
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('plant_manager|operator');
    expect(document.querySelector('[data-module="scheduling"]')).toBeNull();

    document.querySelector('[data-role="user-menu-toggle"]').click();
    const restored = document.querySelector('[data-role="role-select"]');
    restored.value = 'plant_manager';
    restored.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(document.querySelector('[data-role="viewing-as"]')).toBeNull();
    expect(document.querySelector('[data-module="scheduling"]')).toBeTruthy();
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('plant_manager|plant_manager');
  });

  it('no ofrece cambio de rol a un usuario no administrador', async () => {
    await boot();
    const account = accountFor('supervisor');
    await enter(account.username, account.password);

    document.querySelector('[data-role="user-menu-toggle"]').click();

    expect(document.querySelector('[data-role="role-select"]')).toBeNull();
    document.querySelector('[data-module="roles"]').click();
    expect(document.querySelectorAll('[data-select-role]')).toHaveLength(0);
    expect(document.body.textContent).toContain('Páginas disponibles');
  });

  it('permite reiniciar la demo solo a la jefa real y sin cerrar sesión', async () => {
    await boot();
    await enter('jefa.planta', 'Pl4nta2026');

    document.querySelector('[data-role="user-menu-toggle"]').click();
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
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('plant_manager|plant_manager');
    expect(document.body.textContent).toContain('Datos de demo reiniciados');
  });

  it('oculta el reinicio de la demo para roles que no son jefa real', async () => {
    await boot();
    const account = accountFor('operator');
    await enter(account.username, account.password);

    document.querySelector('[data-role="user-menu-toggle"]').click();

    expect(document.querySelector('[data-reset-demo]')).toBeNull();
  });

  it('oculta el reinicio de la demo mientras se visualiza como otro rol', async () => {
    await boot();
    await enter('jefa.planta', 'Pl4nta2026');

    document.querySelector('[data-role="user-menu-toggle"]').click();
    const select = document.querySelector('[data-role="role-select"]');
    select.value = 'operator';
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    document.querySelector('[data-role="user-menu-toggle"]').click();

    expect(document.querySelector('[data-reset-demo]')).toBeNull();
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('plant_manager|operator');
  });
});
