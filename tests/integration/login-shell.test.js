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
    submitLogin(account.username, account.password);

    expect(document.querySelector('.shell')).toBeTruthy();
    expect(document.querySelector('[data-module="admin-roles"]')).toBeNull();
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('operator');

    globalThis.location.hash = '#/admin-roles';
    dom.window.dispatchEvent(new dom.window.Event('hashchange'));

    expect(document.querySelector('[data-module="admin-roles"]')).toBeNull();
    expect(document.querySelector('[data-role="breadcrumb"] strong').textContent).toBe('Estación');
    expect(document.body.textContent).not.toContain('Entrar como');
  });

  it('permite a la Jefa de Planta consultar los datos de roles', async () => {
    await boot();
    const account = accountFor('plant_manager');
    submitLogin(account.username, account.password);

    const adminButton = document.querySelector('[data-module="admin-roles"]');
    expect(adminButton).toBeTruthy();
    adminButton.click();

    expect(document.querySelectorAll('[data-pick-role]')).toHaveLength(ROLE_ORDER.length);
    expect(document.body.textContent).toContain(ROLE_DESCRIPTIONS.operator);
    expect(document.body.textContent).toContain('Entrar como');
  });

  it('entra con la cuenta usuario y obtiene permisos de administrador', async () => {
    await boot();
    submitLogin('usuario', 'usuario');

    expect(document.querySelector('[data-role="login-form"]')).toBeNull();
    expect(document.querySelector('[data-module="admin-roles"]')).toBeTruthy();
    expect(localStorage.getItem('erp.manufacturing.role')).toBe('plant_manager');
  });

  it('vuelve al login al cerrar sesión', async () => {
    await boot();
    const account = accountFor('planner');
    submitLogin(account.username, account.password);

    document.querySelector('.topbar__logout').click();

    expect(document.querySelector('[data-role="login-form"]')).toBeTruthy();
    expect(localStorage.getItem('erp.manufacturing.role')).toBeNull();
  });
});
