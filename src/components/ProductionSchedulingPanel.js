/**
 * @file Planificación de producción (US-10): resumen, filtros y edición de
 * fechas planificadas con validación de calendario y rango.
 */

import { escapeHtml, el, orderStatusBadge } from './format.js';

const PRIORITY_LABEL = { low: 'Baja', normal: 'Normal', high: 'Alta' };

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @returns {HTMLElement}
 */
export function ProductionSchedulingPanel(store) {
  const filters = { status: '', dateFrom: '', dateTo: '' };

  const root = el(`
    <section class="view">
      <header class="view__header">
        <div>
          <h1>Planificación de Producción</h1>
          <p class="view__subtitle">Fechas planificadas por orden. Las órdenes cerradas no admiten cambios.</p>
        </div>
        <div class="inline-actions">
          <span class="badge badge--muted" data-summary="planned">Planificadas: 0</span>
          <span class="badge badge--warn" data-summary="unplanned">Sin fechas: 0</span>
          <span class="badge badge--danger" data-summary="overdue">Atrasadas: 0</span>
        </div>
      </header>
      <article class="panel">
        <div class="filter-row">
          <label class="inline-field">Estado
            <select data-role="filter-status">
              <option value="">Abiertas</option>
              <option value="planned">Planificada</option>
              <option value="released">Liberada</option>
              <option value="in_progress">En Proceso</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
          <label class="inline-field">Desde
            <input type="date" data-role="filter-from" />
          </label>
          <label class="inline-field">Hasta
            <input type="date" data-role="filter-to" />
          </label>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Orden</th><th>Producto</th><th>Estado</th><th>Prioridad</th><th>Inicio</th><th>Término</th><th></th></tr>
            </thead>
            <tbody data-role="rows"></tbody>
          </table>
        </div>
        <p class="empty-note" data-role="empty" hidden>Sin órdenes para los filtros seleccionados.</p>
      </article>
    </section>`);

  const rowsEl = root.querySelector('[data-role="rows"]');
  const emptyEl = root.querySelector('[data-role="empty"]');
  const statusFilter = root.querySelector('[data-role="filter-status"]');
  const fromFilter = root.querySelector('[data-role="filter-from"]');
  const toFilter = root.querySelector('[data-role="filter-to"]');

  function renderSummary() {
    const summary = store.orderScheduleSummary();
    root.querySelector('[data-summary="planned"]').textContent = `Planificadas: ${summary.planned}`;
    root.querySelector('[data-summary="unplanned"]').textContent =
      `Sin fechas: ${summary.unplanned}`;
    root.querySelector('[data-summary="overdue"]').textContent = `Atrasadas: ${summary.overdue}`;
  }

  function renderRows() {
    const orders = store.ordersForScheduling({
      status: filters.status || null,
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
    });
    emptyEl.hidden = orders.length > 0;
    rowsEl.innerHTML = orders
      .map((order) => {
        const closed = order.status === 'completed' || order.status === 'cancelled';
        const product = store.productById(order.product_id);
        return `<tr data-order="${escapeHtml(order.id)}">
          <td>${escapeHtml(order.order_number)}</td>
          <td>${escapeHtml(product ? product.name : order.product_id)}</td>
          <td>${orderStatusBadge(order.status)}</td>
          <td>${escapeHtml(PRIORITY_LABEL[order.priority] || order.priority)}</td>
          <td><input type="date" data-date="start" data-order="${escapeHtml(order.id)}" value="${escapeHtml(order.planned_start_date || '')}" ${closed ? 'disabled' : ''} /></td>
          <td><input type="date" data-date="end" data-order="${escapeHtml(order.id)}" value="${escapeHtml(order.planned_end_date || '')}" ${closed ? 'disabled' : ''} /></td>
          <td class="row-actions">
            <button type="button" class="btn btn--tiny btn--primary" data-save="${escapeHtml(order.id)}" ${closed ? 'disabled' : ''}>Guardar</button>
            <button type="button" class="btn btn--tiny" data-clear="${escapeHtml(order.id)}" ${closed ? 'disabled' : ''}>Limpiar</button>
            <span class="form-error" data-error="${escapeHtml(order.id)}" role="alert"></span>
          </td>
        </tr>`;
      })
      .join('');

    for (const button of rowsEl.querySelectorAll('[data-save]')) {
      button.addEventListener('click', () => save(button.getAttribute('data-save')));
    }
    for (const button of rowsEl.querySelectorAll('[data-clear]')) {
      button.addEventListener('click', () => save(button.getAttribute('data-clear'), true));
    }
  }

  function save(orderId, clear = false) {
    const startInput = rowsEl.querySelector(`[data-date="start"][data-order="${orderId}"]`);
    const endInput = rowsEl.querySelector(`[data-date="end"][data-order="${orderId}"]`);
    const errorEl = rowsEl.querySelector(`[data-error="${orderId}"]`);
    try {
      store.updatePlannedDates(orderId, {
        planned_start_date: clear ? null : startInput.value || null,
        planned_end_date: clear ? null : endInput.value || null,
      });
      errorEl.textContent = '';
      render();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }

  function render() {
    renderSummary();
    renderRows();
  }

  statusFilter.addEventListener('change', () => {
    filters.status = statusFilter.value;
    renderRows();
  });
  fromFilter.addEventListener('change', () => {
    filters.dateFrom = fromFilter.value;
    renderRows();
  });
  toFilter.addEventListener('change', () => {
    filters.dateTo = toFilter.value;
    renderRows();
  });
  store.addEventListener('change', render);
  render();
  return root;
}
