/**
 * @file Panel de desempeño de planta (US-08): indicadores consolidados,
 * umbrales, acciones sobre órdenes y exportación local.
 */

import { escapeHtml, el, fmtNumber, fmtPercent, orderStatusBadge } from './format.js';
import { downloadCsv, printReport } from '../data/exporters/plant-report.js';
import { decimalInput, parseDecimal } from './numeric-field.js';
import { notifyDialog } from './ConfirmDialog.js';

const PERIODS = {
  october: { from: '2026-10-01', to: '2026-10-31', label: 'Octubre 2026' },
  november: { from: '2026-11-01', to: '2026-11-30', label: 'Noviembre 2026' },
  all: { label: 'Todo el historial' },
};

const INDICATOR_LABEL = {
  load: 'Carga máxima',
  oee: 'OEE promedio',
  downtime: 'Paradas acumuladas',
  fulfillment: 'Cumplimiento',
};

function formatIndicator(indicator, value) {
  if (value === null || value === undefined) return '—';
  if (indicator === 'downtime') return `${fmtNumber(value, 2)} min`;
  return fmtPercent(value);
}

const PRIORITY_LABEL = { low: 'Baja', normal: 'Normal', high: 'Alta' };

function miniBar(value, max = 1) {
  const ratio = Number(max) > 0 ? Number(value) / Number(max) : 0;
  const width = Number.isFinite(ratio) ? Math.min(100, Math.max(0, ratio * 100)) : 0;
  return `<div class="bar"><div class="bar__fill" style="width: ${width}%"></div></div>`;
}

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @param {{role?: string}} [options]
 * @returns {HTMLElement}
 */
export function PlantPerformancePanel(store, options = {}) {
  let periodKey = 'october';
  let role = options.role || 'plant_manager';

  const root = el(`
    <section class="view">
      <header class="view__header">
        <div>
          <h1>Desempeño de Planta</h1>
          <p class="view__subtitle">Indicadores agregados por período. El rol global fija el valor inicial; puedes simular otros permisos aquí. Solo contexto operacional — no evaluación de desempeño.</p>
        </div>
        <div class="inline-actions">
          <label class="inline-field">Período
            <select data-role="period">
              <option value="october">Octubre 2026</option>
              <option value="november">Noviembre 2026</option>
              <option value="all">Todo el historial</option>
            </select>
          </label>
          <label class="inline-field">Rol simulado
            <select data-role="role">
              <option value="plant_manager">Jefa de Planta</option>
              <option value="supervisor">Supervisor de línea</option>
              <option value="planner">Planificador</option>
              <option value="operator">Operador de Máquina</option>
            </select>
          </label>
          <button type="button" class="btn" data-export="csv">Exportar CSV</button>
          <button type="button" class="btn" data-export="pdf">Exportar PDF</button>
        </div>
      </header>
      <div class="performance-body" data-role="body"></div>
      <div class="modal-root" data-role="modal-root"></div>
    </section>`);

  const bodyEl = root.querySelector('[data-role="body"]');
  const modalRoot = root.querySelector('[data-role="modal-root"]');
  const periodEl = root.querySelector('[data-role="period"]');
  const roleEl = root.querySelector('[data-role="role"]');

  function currentPeriod() {
    return PERIODS[periodKey];
  }

  function render() {
    const period = currentPeriod();
    const data = store.plantPerformanceFor(period);
    const canSetThreshold = store.canPerformActionFor(role, 'set_threshold');
    const canChangePriority = store.canPerformActionFor(role, 'change_priority');
    const canCancel = store.canPerformActionFor(role, 'cancel_order');
    const canExport = store.canPerformActionFor(role, 'export_report');

    const breachedIndicators = new Set(
      data.thresholds.filter((row) => row.breached).map((row) => row.indicator),
    );
    const kpis = ['load', 'oee', 'downtime', 'fulfillment']
      .map(
        (indicator) => `
        <article class="kpi-card kpi-card--plant ${breachedIndicators.has(indicator) ? 'kpi-card--alert' : ''}" data-kpi="${indicator}">
          <span class="kpi-card__label">${INDICATOR_LABEL[indicator]}</span>
          <span class="kpi-card__value">${formatIndicator(indicator, data.indicators[indicator])}</span>
        </article>`,
      )
      .join('');

    const alarms = data.thresholds.filter((row) => row.breached);
    const alarmRows = alarms.length
      ? alarms
          .map(
            (row) =>
              `<li data-alarm="${escapeHtml(row.indicator)}">${escapeHtml(INDICATOR_LABEL[row.indicator] || row.indicator)}: ${formatIndicator(row.indicator, row.value)} (umbral ${row.comparison === 'gt' ? '>' : '<'} ${formatIndicator(row.indicator, row.threshold)})</li>`,
          )
          .join('')
      : '<li class="empty-note">Sin alertas de umbral.</li>';

    const centerRows = store.workCenters
      .map((workCenter) => {
        const load = data.load_by_work_center[workCenter.id];
        const oee = data.oee_by_work_center[workCenter.id];
        return `<tr data-wc="${escapeHtml(workCenter.id)}">
          <td>${escapeHtml(workCenter.name)}</td>
          <td>${load.invalid_capacity ? '—' : `${fmtNumber(load.load_minutes, 2)} / ${fmtNumber(load.capacity_minutes, 2)}`}</td>
          <td class="perf-bar"><div class="cell--bar">${miniBar(load.load_ratio)}<span class="bar__label">${load.load_ratio === null ? '—' : fmtPercent(load.load_ratio)}</span></div></td>
          <td class="perf-bar"><div class="cell--bar">${miniBar(oee && oee.oee)}<span class="bar__label">${oee && oee.oee !== null ? fmtPercent(oee.oee) : '—'}</span></div></td>
        </tr>`;
      })
      .join('');

    const maxDowntime = Math.max(
      0,
      ...data.downtime_by_reason.map((row) => Number(row.downtime_minutes) || 0),
    );
    const downtimeRows = data.downtime_by_reason.length
      ? data.downtime_by_reason
          .map(
            (row) =>
              `<tr data-downtime="${escapeHtml(row.reason_id)}"><td>${escapeHtml(row.reason_label)}</td><td class="perf-bar"><div class="cell--bar">${miniBar(row.downtime_minutes, maxDowntime)}<span class="bar__label">${fmtNumber(row.downtime_minutes, 2)}</span></div></td></tr>`,
          )
          .join('')
      : '<tr><td colspan="2" class="empty-cell">Sin paradas cerradas en el período.</td></tr>';

    const actionOrders = store.productionOrders.filter(
      (order) => order.status !== 'completed' && order.status !== 'cancelled',
    );
    const orderRows = actionOrders
      .map((order) => {
        const priorityDisabled = !canChangePriority || order.status !== 'planned';
        return `<tr data-order="${escapeHtml(order.id)}">
          <td>${escapeHtml(order.order_number)}</td>
          <td>${orderStatusBadge(order.status)}</td>
          <td class="perf-select">
            <select data-priority="${escapeHtml(order.id)}" ${priorityDisabled ? 'disabled' : ''}>
              ${['low', 'normal', 'high']
                .map(
                  (priority) =>
                    `<option value="${priority}" ${order.priority === priority ? 'selected' : ''}>${PRIORITY_LABEL[priority]}</option>`,
                )
                .join('')}
            </select>
          </td>
          <td class="perf-action"><button type="button" class="btn btn--tiny btn--danger" data-cancel="${escapeHtml(order.id)}" ${canCancel ? '' : 'disabled'}>Cancelar</button></td>
        </tr>`;
      })
      .join('');

    bodyEl.innerHTML = `
      <div class="kpi-grid kpi-grid--plant">${kpis}</div>
      <div class="panel-grid panel-grid--plant">
        <article class="panel">
          <header class="panel__header"><h3>Alertas de umbral</h3></header>
          <div class="panel__body">
            <ul class="alarm-list">${alarmRows}</ul>
          </div>
        </article>
        <article class="panel">
          <header class="panel__header"><h3>Configurar umbral</h3></header>
          <div class="panel__body">
            <form class="stack-form" data-role="threshold-form">
              <label>Indicador
                <select name="indicator">
                  <option value="load">Carga máxima</option>
                  <option value="oee">OEE promedio</option>
                  <option value="downtime">Paradas acumuladas</option>
                  <option value="fulfillment">Cumplimiento</option>
                </select>
              </label>
              <label>Umbral
                ${decimalInput({ name: 'threshold', required: true, min: 0, label: 'El umbral' })}
              </label>
              <label>Comparación
                <select name="comparison">
                  <option value="gt">Al superar (gt)</option>
                  <option value="lt">Al caer bajo (lt)</option>
                </select>
              </label>
              <p class="form-error" data-role="threshold-error" role="alert"></p>
              <button type="submit" class="btn btn--primary" ${canSetThreshold ? '' : 'disabled'}>Guardar umbral</button>
              <p class="empty-note">${canSetThreshold ? '' : 'El rol simulado no puede modificar umbrales.'}</p>
            </form>
          </div>
        </article>
      </div>
      <article class="panel">
        <header class="panel__header"><h3>Carga y OEE por centro</h3></header>
        <div class="panel__body">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Centro</th><th>Carga / capacidad (min)</th><th>Utilización</th><th>OEE</th></tr></thead>
              <tbody>${centerRows}</tbody>
            </table>
          </div>
        </div>
      </article>
      <article class="panel">
        <header class="panel__header"><h3>Paradas por motivo</h3></header>
        <div class="panel__body">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Motivo</th><th>Minutos</th></tr></thead>
              <tbody>${downtimeRows}</tbody>
            </table>
          </div>
        </div>
      </article>
      <article class="panel">
        <header class="panel__header"><h3>Acciones sobre órdenes</h3></header>
        <div class="panel__body">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Orden</th><th>Estado</th><th>Prioridad</th><th></th></tr></thead>
              <tbody>${orderRows || '<tr><td colspan="4" class="empty-cell">Sin órdenes accionables.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </article>`;

    bodyEl.querySelectorAll('[data-priority]').forEach((select) => {
      select.addEventListener('change', async () => {
        try {
          store.changeOrderPriority(select.getAttribute('data-priority'), select.value);
          render();
        } catch (err) {
          await notifyDialog({ title: 'No se pudo cambiar la prioridad', message: err.message });
        }
      });
    });
    bodyEl.querySelectorAll('[data-cancel]').forEach((button) => {
      button.addEventListener('click', () => openCancel(button.getAttribute('data-cancel')));
    });

    const thresholdForm = bodyEl.querySelector('[data-role="threshold-form"]');
    thresholdForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const dataForm = new FormData(thresholdForm);
      try {
        store.setIndicatorThreshold({
          indicator: dataForm.get('indicator'),
          threshold: parseDecimal(dataForm.get('threshold'), {
            required: true,
            min: 0,
            label: 'El umbral',
          }),
          comparison: dataForm.get('comparison'),
        });
        render();
      } catch (err) {
        bodyEl.querySelector('[data-role="threshold-error"]').textContent = err.message;
      }
    });

    for (const button of root.querySelectorAll('[data-export]')) {
      button.disabled = !canExport;
      button.title = canExport ? '' : 'El rol simulado no puede exportar.';
    }
  }

  function openCancel(orderId) {
    const order = store.orderById(orderId);
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-role="cancel-modal">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
          <h2 id="cancel-title">Cancelar orden ${escapeHtml(order.order_number)}</h2>
          <form class="stack-form" data-role="cancel-form">
            <label>Motivo de cancelación
              <textarea name="reason" rows="3" required></textarea>
            </label>
            <p class="form-error" data-role="error" role="alert"></p>
            <div class="modal-actions">
              <button type="button" class="btn" data-role="dismiss">Volver</button>
              <button type="submit" class="btn btn--primary btn--danger">Cancelar orden</button>
            </div>
          </form>
        </div>
      </div>`;
    const close = () => {
      modalRoot.innerHTML = '';
    };
    modalRoot.querySelector('[data-role="dismiss"]').addEventListener('click', close);
    modalRoot.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
    const form = modalRoot.querySelector('[data-role="cancel-form"]');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      try {
        store.cancelOrderFromPanel(orderId, { reason: data.get('reason') });
        close();
        render();
      } catch (err) {
        form.querySelector('[data-role="error"]').textContent = err.message;
      }
    });
  }

  periodEl.addEventListener('change', () => {
    periodKey = periodEl.value;
    render();
  });
  roleEl.addEventListener('change', () => {
    role = roleEl.value;
    render();
  });
  for (const button of root.querySelectorAll('[data-export]')) {
    button.addEventListener('click', () => {
      const report = store.consolidatedReportFor(currentPeriod());
      if (button.getAttribute('data-export') === 'csv') downloadCsv(report);
      else printReport(report);
    });
  }
  roleEl.value = role;
  store.addEventListener('change', render);
  render();
  return root;
}
