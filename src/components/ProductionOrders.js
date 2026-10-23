/**
 * @file Seguimiento de órdenes de producción: tablero kanban + lista + detalle.
 * Ver US-03, US-04, US-05 (plan.md §2) y data-model.md §3.11–3.14.
 */

import {
  fmtNumber,
  fmtPercent,
  escapeHtml,
  el,
  orderStatusBadge,
  ORDER_STATUS_LABEL,
  OP_STATUS_LABEL,
  QUALITY_LABEL,
} from './format.js';

const BOARD_COLUMNS = ['planned', 'released', 'in_progress', 'completed'];

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @returns {HTMLElement}
 */
export function ProductionOrders(store) {
  let selectedOrderId = null;

  const root = el(`
    <section class="view">
      <header class="view__header">
        <div>
          <h1>Órdenes de Producción</h1>
          <p class="view__subtitle">Despacho, estado y trazabilidad plan-vs-real.</p>
        </div>
        <button type="button" class="btn btn--primary" data-role="new-order">Nueva Orden</button>
      </header>
      <div class="orders-layout">
        <div class="orders-board" data-role="board"></div>
        <aside class="panel panel--side" data-role="detail"></aside>
      </div>
      <div class="modal-root" data-role="modal-root"></div>
    </section>`);

  const boardEl = root.querySelector('[data-role="board"]');
  const detailEl = root.querySelector('[data-role="detail"]');
  const modalRoot = root.querySelector('[data-role="modal-root"]');

  function renderBoard() {
    boardEl.innerHTML = BOARD_COLUMNS.map((status) => {
      const orders = store.productionOrders.filter((o) => o.status === status);
      const cards = orders.map((order) => card(order)).join('');
      return `
        <div class="kanban-col">
          <header class="kanban-col__header">
            <span>${ORDER_STATUS_LABEL[status]}</span>
            <span class="kanban-col__count">${orders.length}</span>
          </header>
          <div class="kanban-col__body">${cards || '<p class="empty-note">Sin órdenes.</p>'}</div>
        </div>`;
    }).join('');

    boardEl.querySelectorAll('[data-order]').forEach((cardEl) => {
      cardEl.addEventListener('click', () => {
        selectedOrderId = cardEl.getAttribute('data-order');
        renderDetail();
      });
    });
  }

  function card(order) {
    const product = store.productById(order.product_id);
    const mto = order.sales_order_id
      ? `<span class="tag tag--mto">MTO · ${escapeHtml(order.sales_order_id)}</span>`
      : '<span class="tag tag--stock">Stock</span>';
    const active = order.id === selectedOrderId ? 'is-active' : '';
    return `
      <button type="button" class="order-card ${active}" data-order="${order.id}">
        <div class="order-card__top">
          <strong>${escapeHtml(order.order_number)}</strong>
          <span class="priority priority--${order.priority}">${order.priority}</span>
        </div>
        <div class="order-card__product">${escapeHtml(product ? product.name : order.product_id)}</div>
        <div class="order-card__meta">
          <span>${fmtNumber(order.quantity_planned)} u</span>
          ${mto}
        </div>
      </button>`;
  }

  function renderDetail() {
    const order = store.orderById(selectedOrderId);
    if (!order) {
      detailEl.innerHTML = `<header class="panel__header"><h2>Detalle</h2></header>
        <p class="empty-note">Selecciona una orden.</p>`;
      return;
    }
    const product = store.productById(order.product_id);
    const ops = store.operationsForOrder(order.id);
    const quality = store.orderQualityStatus(order.id);
    const variances = store.reconcile(order.id);
    const outputs = store.outputForOrder(order.id);
    const plannedTotal = ops.reduce((s, o) => s + o.planned_time_minutes, 0);
    const actualTotal = ops.reduce((s, o) => s + (o.actual_time_minutes || 0), 0);

    const transitions = {
      planned: ['released', 'cancelled'],
      released: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    }[order.status] || [];

    const actions = transitions.map((t) =>
      `<button type="button" class="btn btn--small" data-transition="${t}">${ORDER_STATUS_LABEL[t]}</button>`
    ).join('');

    const opRows = ops.map((op) => {
      const wc = store.workCenterById(op.work_center_id);
      const canStart = op.status === 'pending' || op.status === 'paused';
      const canComplete = op.status === 'in_progress' || op.status === 'paused';
      return `
        <tr data-op="${op.id}">
          <td>${op.sequence}</td>
          <td>${escapeHtml(wc ? wc.name : op.work_center_id)}</td>
          <td><span class="badge badge--op-${op.status}">${OP_STATUS_LABEL[op.status]}</span></td>
          <td>${fmtNumber(op.planned_time_minutes)}</td>
          <td>${op.actual_time_minutes != null ? fmtNumber(op.actual_time_minutes) : '—'}</td>
          <td class="cell--actions">
            ${canStart ? `<button type="button" class="btn btn--tiny" data-start="${op.id}">Iniciar</button>` : ''}
            ${canComplete ? `<button type="button" class="btn btn--tiny btn--primary" data-complete="${op.id}">Completar</button>` : ''}
          </td>
        </tr>`;
    }).join('');

    const varianceRows = variances.map((v) => {
      const prod = store.productById(v.component_product_id);
      return `<tr>
        <td>${escapeHtml(prod ? prod.name : v.component_product_id)}</td>
        <td>${fmtNumber(v.theoretical_quantity, 2)}</td>
        <td>${fmtNumber(v.actual_quantity, 2)}</td>
        <td class="${v.within_tolerance ? '' : 'cell--warn'}">${v.flag === 'unplanned' ? 'no planificado' : fmtPercent(v.variance_ratio)}</td>
      </tr>`;
    }).join('');

    const produced = outputs.reduce((s, o) => s + o.quantity_produced, 0);
    const scrap = outputs.reduce((s, o) => s + o.scrap_quantity, 0);
    const yieldRatio = order.quantity_planned > 0 ? produced / order.quantity_planned : 0;
    const scrapRate = produced + scrap > 0 ? scrap / (produced + scrap) : 0;

    detailEl.innerHTML = `
      <header class="panel__header">
        <h2>${escapeHtml(order.order_number)} ${orderStatusBadge(order.status)}</h2>
        <p class="panel__subtitle">${escapeHtml(product ? product.name : order.product_id)}</p>
      </header>
      <dl class="detail-list">
        <div><dt>Planificado</dt><dd>${fmtNumber(order.quantity_planned)} u</dd></div>
        <div><dt>Producido</dt><dd>${fmtNumber(produced)} u</dd></div>
        <div><dt>Merma</dt><dd>${fmtNumber(scrap)} u</dd></div>
        <div><dt>Yield</dt><dd>${fmtPercent(yieldRatio)}</dd></div>
        <div><dt>Scrap rate</dt><dd>${fmtPercent(scrapRate)}</dd></div>
        <div><dt>Calidad (derivada)</dt><dd><span class="badge badge--qc-${quality}">${QUALITY_LABEL[quality]}</span></dd></div>
        <div><dt>Tiempo plan / real</dt><dd>${fmtNumber(plannedTotal)} / ${fmtNumber(actualTotal)} min</dd></div>
        <div><dt>Origen</dt><dd>${order.sales_order_id ? `MTO (${escapeHtml(order.sales_order_id)})` : 'Stock'}</dd></div>
      </dl>
      <div class="detail-actions">${actions}</div>

      <header class="panel__header"><h3>Operaciones</h3></header>
      <div class="table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>#</th><th>Centro</th><th>Estado</th><th>Plan</th><th>Real</th><th></th></tr></thead>
          <tbody>${opRows || '<tr><td colspan="6" class="empty-cell">Sin operaciones.</td></tr>'}</tbody>
        </table>
      </div>

      <header class="panel__header"><h3>Consumo plan-vs-real</h3></header>
      <div class="table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>Componente</th><th>Teórico</th><th>Real</th><th>Varianza</th></tr></thead>
          <tbody>${varianceRows || '<tr><td colspan="4" class="empty-cell">Sin consumo registrado.</td></tr>'}</tbody>
        </table>
      </div>

      <div class="detail-actions">
        <button type="button" class="btn btn--small" data-role="consume">Registrar Consumo</button>
        <button type="button" class="btn btn--small btn--primary" data-role="output">Registrar Salida</button>
      </div>`;

    detailEl.querySelectorAll('[data-transition]').forEach((btn) => {
      btn.addEventListener('click', () => {
        try {
          store.transitionOrder(order.id, btn.getAttribute('data-transition'));
        } catch (err) {
          window.alert(err.message);
        }
        renderAll();
      });
    });
    detailEl.querySelectorAll('[data-start]').forEach((btn) => {
      btn.addEventListener('click', () => {
        try {
          store.startOperation(btn.getAttribute('data-start'));
        } catch (err) {
          window.alert(err.message);
        }
        renderAll();
      });
    });
    detailEl.querySelectorAll('[data-complete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const opId = btn.getAttribute('data-complete');
        const op = store.productionOrderOperations.find((o) => o.id === opId);
        const value = window.prompt(
          `Tiempo real (min) para la operación ${op.sequence} (plan: ${op.planned_time_minutes}):`,
          String(op.planned_time_minutes)
        );
        if (value == null) return;
        try {
          store.completeOperation(opId, {
            actual_time_minutes: Number(value),
            quantity_completed: order.quantity_planned,
            scrap_quantity: 0,
          });
        } catch (err) {
          window.alert(err.message);
        }
        renderAll();
      });
    });
    const consumeBtn = detailEl.querySelector('[data-role="consume"]');
    if (consumeBtn) consumeBtn.addEventListener('click', () => openConsumptionModal(order));
    const outputBtn = detailEl.querySelector('[data-role="output"]');
    if (outputBtn) outputBtn.addEventListener('click', () => openOutputModal(order));
  }

  function openConsumptionModal(order) {
    const lines = store.bomComponents.filter((c) => c.bom_id === order.bom_id);
    const options = lines.map((line) => {
      const prod = store.productById(line.component_product_id);
      return `<option value="${line.component_product_id}" data-bom="${line.id}" data-uom="${line.uom_id}">
        ${escapeHtml(prod ? prod.name : line.component_product_id)}</option>`;
    }).join('');
    const warehouseOptions = store.warehouses
      .filter((w) => w.warehouse_type === 'raw_materials')
      .map((w) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`)
      .join('');

    showModal(`
      <h2>Registrar Consumo de Material</h2>
      <form data-role="form" class="stack-form">
        <label>Componente
          <select name="component_product_id" required>
            <option value="">Selecciona…</option>${options}
            <option value="__unplanned">— Uso no planificado —</option>
          </select>
        </label>
        <label>Cantidad consumida
          <input name="quantity_consumed" type="number" min="0.0001" step="0.0001" required />
        </label>
        <label>Bodega origen
          <select name="warehouse_id" required>${warehouseOptions}</select>
        </label>
        <label>Lote (opcional)
          <input name="lot_number" type="text" placeholder="LOT-…" />
        </label>
        <p class="form-error" data-role="error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn" data-role="cancel">Cancelar</button>
          <button type="submit" class="btn btn--primary">Registrar</button>
        </div>
      </form>`);
    const form = modalRoot.querySelector('[data-role="form"]');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const errorEl = form.querySelector('[data-role="error"]');
      const componentId = data.get('component_product_id');
      const select = form.querySelector('select[name="component_product_id"]');
      const opt = select.selectedOptions[0];
      const unplanned = componentId === '__unplanned';
      const realComponentId = unplanned
        ? store.products.find((p) => p.product_type !== 'finished_good').id
        : componentId;
      try {
        store.recordConsumption({
          production_order_id: order.id,
          component_product_id: realComponentId,
          bom_component_id: unplanned ? null : opt.getAttribute('data-bom'),
          warehouse_id: data.get('warehouse_id'),
          quantity_consumed: Number(data.get('quantity_consumed')),
          uom_id: unplanned ? 'uom_un' : opt.getAttribute('data-uom'),
          lot_number: data.get('lot_number'),
        });
        closeModal();
        renderAll();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  function openOutputModal(order) {
    const product = store.productById(order.product_id);
    const warehouseOptions = store.warehouses
      .filter((w) => w.warehouse_type === 'finished_goods')
      .map((w) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`)
      .join('');
    showModal(`
      <h2>Registrar Salida de Bien Terminado</h2>
      <form data-role="form" class="stack-form">
        <label>Cantidad producida
          <input name="quantity_produced" type="number" min="0.0001" step="0.0001" required />
        </label>
        <label>Merma
          <input name="scrap_quantity" type="number" min="0" step="0.0001" value="0" />
        </label>
        <label>Bodega destino
          <select name="warehouse_id" required>${warehouseOptions}</select>
        </label>
        <label>Lote (opcional)
          <input name="lot_number" type="text" placeholder="PT-…" />
        </label>
        <p class="form-error" data-role="error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn" data-role="cancel">Cancelar</button>
          <button type="submit" class="btn btn--primary">Registrar</button>
        </div>
      </form>`);
    const form = modalRoot.querySelector('[data-role="form"]');
    form.querySelector('input[name="quantity_produced"]').focus();
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const errorEl = form.querySelector('[data-role="error"]');
      try {
        store.recordOutput({
          production_order_id: order.id,
          product_id: order.product_id,
          warehouse_id: data.get('warehouse_id'),
          quantity_produced: Number(data.get('quantity_produced')),
          scrap_quantity: Number(data.get('scrap_quantity')) || 0,
          lot_number: data.get('lot_number'),
          uom_id: product ? product.uom_id : 'uom_un',
        });
        closeModal();
        renderAll();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  function showModal(innerHtml) {
    modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal">${innerHtml}</div></div>`;
    modalRoot.querySelector('[data-role="cancel"]').addEventListener('click', closeModal);
    modalRoot.querySelector('.modal-backdrop').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) closeModal();
    });
  }

  function closeModal() {
    modalRoot.innerHTML = '';
  }

  function openNewOrderModal() {
    const productOptions = store.products
      .filter((p) => p.product_type === 'finished_good')
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.code)})</option>`)
      .join('');
    const warehouseOptions = store.warehouses
      .map((w) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`)
      .join('');
    const salesOptions = store.salesOrders
      .filter((s) => s.make_to_order)
      .map((s) => `<option value="${s.id}">${escapeHtml(s.order_number)} (MTO)</option>`)
      .join('');
    showModal(`
      <h2>Nueva Orden de Producción</h2>
      <form data-role="form" class="stack-form">
        <label>Producto (bien terminado)
          <select name="product_id" required>
            <option value="">Selecciona…</option>${productOptions}
          </select>
        </label>
        <label>Cantidad planificada
          <input name="quantity_planned" type="number" min="1" step="1" required />
        </label>
        <label>Origen
          <select name="sales_order_id">
            <option value="">Reposición de stock</option>${salesOptions}
          </select>
        </label>
        <label>Bodega destino
          <select name="warehouse_id" required>${warehouseOptions}</select>
        </label>
        <label>Prioridad
          <select name="priority">
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="low">Baja</option>
          </select>
        </label>
        <p class="form-error" data-role="error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn" data-role="cancel">Cancelar</button>
          <button type="submit" class="btn btn--primary">Crear</button>
        </div>
      </form>`);
    const form = modalRoot.querySelector('[data-role="form"]');
    form.querySelector('select[name="product_id"]').addEventListener('change', (e) => {
      const productId = e.target.value;
      const bom = store.billOfMaterials.find((b) => b.product_id === productId && b.status === 'active');
      const routing = store.routings.find((r) => r.product_id === productId && r.status === 'active');
      form.dataset.bom = bom ? bom.id : '';
      form.dataset.routing = routing ? routing.id : '';
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const order = store.createOrder({
        product_id: data.get('product_id'),
        bom_id: form.dataset.bom,
        routing_id: form.dataset.routing,
        sales_order_id: data.get('sales_order_id') || null,
        warehouse_id: data.get('warehouse_id'),
        quantity_planned: Number(data.get('quantity_planned')),
        priority: data.get('priority'),
      });
      selectedOrderId = order.id;
      closeModal();
      renderAll();
    });
  }

  function renderAll() {
    renderBoard();
    renderDetail();
  }

  root.querySelector('[data-role="new-order"]').addEventListener('click', openNewOrderModal);
  store.addEventListener('change', renderAll);
  renderAll();
  return root;
}
