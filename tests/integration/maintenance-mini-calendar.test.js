import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { MaintenancePanel } from '../../src/components/MaintenancePanel.js';

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
let store;

function click(selector) {
  const node = document.querySelector(selector);
  expect(node, `Nodo no encontrado: ${selector}`).toBeTruthy();
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  store = new ManufacturingStore({ storage: memoryStorage() });
  document.body.appendChild(MaintenancePanel(store));
  click('[data-role="maintenance-tab"][data-tab="machines"]');
  click('[data-role="machine-row"][data-machine-id="wc_solda"]');
});

afterEach(() => {
  dom.window.close();
  vi.restoreAllMocks();
});

describe('Mini-calendario compacto (US-15 / AC-110–AC-111)', () => {
  it('usa grid compacto, leyenda superior y celdas redondeadas sin tabla', () => {
    const calendar = document.querySelector('.machine-calendar');
    expect(calendar).toBeTruthy();
    expect(calendar.querySelector('table')).toBeNull();
    expect(calendar.querySelector('.machine-calendar__grid')).toBeTruthy();

    const children = [...calendar.children];
    expect(children.indexOf(calendar.querySelector('.machine-calendar__legend'))).toBeLessThan(
      children.indexOf(calendar.querySelector('.machine-calendar__grid')),
    );
    expect(calendar.querySelectorAll('.machine-calendar__weekday')).toHaveLength(7);
    expect(calendar.querySelectorAll('.machine-calendar__cell').length).toBeGreaterThanOrEqual(28);
    expect(calendar.querySelectorAll('[data-machine-calendar-nav]')).toHaveLength(2);
    expect(calendar.querySelector('[data-machine-calendar-nav="prev"]').textContent.trim()).toBe(
      '‹',
    );
    expect(calendar.querySelector('[data-machine-calendar-nav="next"]').textContent.trim()).toBe(
      '›',
    );

    expect(cssRule('.machine-calendar')).toMatch(/max-width:\s*520px/);
    expect(cssRule('.machine-calendar__grid')).toMatch(/display:\s*grid/);
    expect(cssRule('.machine-calendar__grid')).toMatch(/gap:\s*\d/);
    expect(cssRule('.machine-calendar__cell')).toMatch(/border-radius:\s*8px/);
    expect(cssRule('.machine-calendar__cell')).toMatch(/aspect-ratio:\s*2\.5\s*\/\s*1/);
    expect(cssRule('.machine-calendar__cell')).not.toMatch(/border:\s*1px\s+solid/);
  });
});
