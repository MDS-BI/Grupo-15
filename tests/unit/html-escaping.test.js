import { describe, expect, it } from 'vitest';
import { ProductionOrders } from '../../src/components/ProductionOrders.js';

describe('escapeHtml en los componentes', () => {
  it('muestra un nombre de producto con marcado como texto, no como HTML', () => {
    const products = [{ id: 'prod_x', name: '<b>x</b>', code: 'PX-1' }];
    const orders = [
      {
        id: 'po_x',
        order_number: 'OP-1',
        product_id: 'prod_x',
        status: 'planned',
        quantity_planned: 1,
        priority: 'normal',
        sales_order_id: null,
      },
    ];
    const store = {
      productionOrders: orders,
      orderById: (id) => orders.find((order) => order.id === id) || null,
      productById: (id) => products.find((product) => product.id === id) || null,
      addEventListener: () => {},
    };

    const root = ProductionOrders(store);
    const productEl = root.querySelector('[data-order="po_x"] .order-card__product');

    expect(productEl.textContent).toBe('<b>x</b>');
    expect(productEl.querySelector('b')).toBeNull();
    expect(root.innerHTML).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
