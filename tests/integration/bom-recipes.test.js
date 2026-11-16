import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { BomExplorer } from '../../src/components/BomExplorer.js';

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
  expect(node).toBeTruthy();
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

function setValue(selector, value) {
  const node = document.querySelector(selector);
  expect(node).toBeTruthy();
  node.value = value;
  node.dispatchEvent(new window.Event('input', { bubbles: true }));
  node.dispatchEvent(new window.Event('change', { bubbles: true }));
}

function submit(selector) {
  const node = document.querySelector(selector);
  expect(node).toBeTruthy();
  node.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.FormData = dom.window.FormData;
  store = new ManufacturingStore({ storage: memoryStorage() });
});

afterEach(() => {
  dom.window.close();
});

describe('Autoría de recetas BOM', () => {
  it('crea una receta con nombre de producto, materiales, estaciones y tiempos', () => {
    document.body.appendChild(BomExplorer(store));
    click('[data-role="new-recipe"]');

    setValue('.modal [name="product_name"]', 'Mesa Industrial');
    setValue('.modal [data-material-row] [name="material_product_id"]', 'comp_tubo');
    setValue('.modal [data-material-row] [name="material_quantity"]', '2');
    setValue('.modal [data-station-row] [name="station_work_center_id"]', 'wc_corte');
    setValue('.modal [data-station-row] [name="station_setup"]', '5');
    setValue('.modal [data-station-row] [name="station_time"]', '3');
    submit('.modal [data-role="form"]');

    const product = store.products.find((item) => item.name === 'Mesa Industrial');
    expect(product).toBeTruthy();
    const bom = store.activeBoms().find((item) => item.product_id === product.id);
    expect(bom).toBeTruthy();
    expect(store.bomMaterials(bom.id)).toHaveLength(1);
    expect(store.bomMaterials(bom.id)[0].quantity_per_unit).toBe(2);
    const stations = store.bomStations(bom.id);
    expect(stations).toHaveLength(1);
    expect(stations[0].work_center_id).toBe('wc_corte');
    expect(stations[0].run_time_per_unit_minutes).toBe(3);
    expect(document.querySelector('[data-role="modal-root"]').innerHTML).toBe('');
  });

  it('modifica la cantidad de un material y avisa cuando el cambio queda vacío', () => {
    document.body.appendChild(BomExplorer(store));
    click('[data-role="edit-recipe"]');
    setValue('.modal [name="change_value"]', '3');
    submit('.modal [data-role="form"]');
    expect(store.bomMaterials('bom_bici')[0].quantity_per_unit).toBe(3);

    const confirm = window.confirm;
    window.confirm = () => false;
    click('[data-role="edit-recipe"]');
    setValue('.modal [name="field"]', 'code');
    setValue('.modal [name="change_value"]', '');
    submit('.modal [data-role="form"]');
    expect(document.querySelector('.modal [data-role="error"]').textContent).toContain('vacío');
    expect(store.billOfMaterials.some((bom) => bom.id === 'bom_bici')).toBe(true);
    window.confirm = confirm;
  });

  it('elimina la receta seleccionada por nombre de producto tras confirmar', () => {
    document.body.appendChild(BomExplorer(store));
    const confirm = window.confirm;
    window.confirm = () => true;
    click('[data-role="delete-recipe"]');
    setValue('.modal [name="bom_id"]', 'bom_rueda');
    submit('.modal [data-role="form"]');
    expect(store.billOfMaterials.some((bom) => bom.id === 'bom_rueda')).toBe(false);
    expect(store.bomComponents.some((component) => component.bom_id === 'bom_rueda')).toBe(false);
    window.confirm = confirm;
  });
});
