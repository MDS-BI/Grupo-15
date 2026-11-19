/**
 * @file Balance de líneas (US-11): carga proyectada, utilización y cuello de
 * botella por período, más detalle por orden.
 */

import { escapeHtml, el, fmtNumber, fmtPercent } from './format.js';

const PERIODS = {
  october: { from: '2026-10-01', to: '2026-10-31', label: 'Octubre 2026' },
  november: { from: '2026-11-01', to: '2026-11-30', label: 'Noviembre 2026' },
  all: { label: 'Todo el historial' },
};

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @returns {HTMLElement}
 */
export function LineBalancePanel(store) {
  let periodKey = 'october';
  let selectedOrderId = '';

  const root = el(`
    <section class="view">
      <header class="view__header">
        <div>
          <h1>Balance de Líneas</h1>
          <p class="view__subtitle">Carga proyectada vs. capacidad nominal. Solo contexto operacional — no evaluación de desempeño.</p>
        </div>
        <div class="inline-actions">
          <label class="inline-field">Período
            <select data-role="period">
              <option value="october">Octubre 2026</option>
              <option value="november">Noviembre 2026</option>
              <option value="all">Todo el historial</option>
            </select>
          </label>
          <span class="badge badge--danger" data-bottleneck>Sin cuello de botella</span>
        </div>
      </header>
      <div data-role="body"></div>
    </section>`);

  const bodyEl = root.querySelector('[data-role="body"]');
  const periodEl = root.querySelector('[data-role="period"]');
  const bottleneckEl = root.querySelector('[data-bottleneck]');

  function render() {
    const period = PERIODS[periodKey];
    const balance = store.lineBalanceFor(period);

    bottleneckEl.textContent = balance.bottleneck
      ? `Cuello de botella: ${balance.bottleneck.name} (${fmtPercent(balance.bottleneck.utilization)})`
      : 'Sin cuello de botella';

    const rows = balance.utilization_by_work_center
      .map((row) => {
        const standard = balance.standard_times[row.work_center_id];
        const isBottleneck =
          balance.bottleneck && balance.bottleneck.work_center_id === row.work_center_id;
        return `<tr data-wc="${escapeHtml(row.work_center_id)}" class="${isBottleneck ? 'is-bottleneck' : ''}">
          <td>${escapeHtml(row.name)}${isBottleneck ? ' <span class="badge badge--danger">Cuello</span>' : ''}</td>
          <td>${fmtNumber(row.load_minutes, 2)}</td>
          <td>${fmtNumber(row.capacity_minutes, 2)}</td>
          <td>${row.utilization === null ? '—' : fmtPercent(row.utilization)}</td>
          <td>${standard ? fmtNumber(standard.setup_time_minutes, 2) : '—'}</td>
          <td>${standard ? fmtNumber(standard.run_time_per_unit_minutes, 2) : '—'}</td>
        </tr>`;
      })
      .join('');

    const unscheduled = balance.unscheduled_order_ids;
    const unscheduledText = unscheduled.length
      ? unscheduled
          .map((orderId) => {
            const order = store.orderById(orderId);
            return order ? order.order_number : orderId;
          })
          .join(', ')
      : 'Ninguna';

    const schedulableOrders = store.productionOrders.filter(
      (order) => order.planned_start_date || order.planned_end_date,
    );
    if (!schedulableOrders.some((order) => order.id === selectedOrderId)) {
      selectedOrderId = schedulableOrders[0] ? schedulableOrders[0].id : '';
    }
    const orderDetail = selectedOrderId ? store.lineBalanceForOrder(selectedOrderId) : null;
    const orderRows = orderDetail
      ? orderDetail.utilization_by_work_center
          .map((row) => {
            const load = orderDetail.load_by_work_center[row.work_center_id];
            return `<tr data-order-wc="${escapeHtml(row.work_center_id)}">
              <td>${escapeHtml(row.name)}</td>
              <td>${fmtNumber(load ? load.load_minutes : 0, 2)}</td>
              <td>${row.utilization === null ? '—' : fmtPercent(row.utilization)}</td>
            </tr>`;
          })
          .join('')
      : '';

    bodyEl.innerHTML = `
      <article class="panel">
        <header class="panel__header">
          <h3>Carga por centro · ${escapeHtml(period.label)}</h3>
          <p class="panel__subtitle" data-unscheduled>Órdenes sin fechas excluidas: ${unscheduled.length} (${escapeHtml(unscheduledText)})</p>
        </header>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Centro</th><th>Carga (min)</th><th>Capacidad (min)</th><th>Utilización</th><th>Setup estándar</th><th>Run estándar /u</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </article>
      <article class="panel">
        <header class="panel__header">
          <h3>Detalle por orden</h3>
          <label class="inline-field">Orden
            <select data-role="order-select">
              ${schedulableOrders
                .map(
                  (order) =>
                    `<option value="${escapeHtml(order.id)}" ${order.id === selectedOrderId ? 'selected' : ''}>${escapeHtml(order.order_number)}</option>`,
                )
                .join('')}
            </select>
          </label>
        </header>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Centro</th><th>Carga de la orden (min)</th><th>Utilización del período</th></tr></thead>
            <tbody>${orderRows || '<tr><td colspan="3" class="empty-cell">Sin orden seleccionada.</td></tr>'}</tbody>
          </table>
        </div>
      </article>`;

    const orderSelect = bodyEl.querySelector('[data-role="order-select"]');
    if (orderSelect) {
      orderSelect.addEventListener('change', () => {
        selectedOrderId = orderSelect.value;
        render();
      });
    }
  }

  periodEl.addEventListener('change', () => {
    periodKey = periodEl.value;
    render();
  });
  store.addEventListener('change', render);
  render();
  return root;
}
