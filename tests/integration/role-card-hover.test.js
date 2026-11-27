import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { RoleAccessPanel } from '../../src/components/RoleAccessPanel.js';

const css = readFileSync(resolve('src/styles/manufacturing.css'), 'utf8');

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  expect(match, `Regla CSS no encontrada: ${selector}`).toBeTruthy();
  return match[1];
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

let dom;

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  document.body.append(
    RoleAccessPanel({
      currentRole: 'plant_manager',
      username: 'jefa.planta',
      store: new ManufacturingStore({ storage: memoryStorage() }),
      modules: [{ id: 'maintenance', label: 'Mantenimiento' }],
      initialTab: 'roles',
    }),
  );
});

afterEach(() => {
  dom.window.close();
  vi.restoreAllMocks();
});

describe('Hover oscurecido en tarjetas de rol (US-12 / AC-104)', () => {
  it('oscurece toda el área de las tarjetas sin cambiar tamaño ni esquinas', () => {
    expect(document.querySelectorAll('[data-role-card]').length).toBeGreaterThan(1);
    expect(cssRule('.role-card')).toMatch(/cursor:\s*pointer/);
    expect(cssRule('.role-card:hover')).toMatch(/background-color:\s*#/);
    expect(cssRule('.role-card:hover')).toMatch(/border-color:\s*#/);
    expect(cssRule('.role-card:hover')).not.toMatch(/transform|width|height|border-radius/);
    expect(cssRule('.role-select-card:hover')).toMatch(/background-color:\s*#/);
  });
});
