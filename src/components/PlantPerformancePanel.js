/**
 * @file Panel de desempeño de planta (US-08): indicadores consolidados,
 * umbrales, acciones sobre órdenes y exportación local.
 */

import {
  escapeHtml,
  el,
  fmtNumber,
  fmtPercent,
  formatDurationLong,
  ORDER_STATUS_LABEL,
} from './format.js';
import { downloadCsv, printReport } from '../data/exporters/plant-report.js';
import { decimalInput, parseDecimal } from './numeric-field.js';
import { notifyDialog } from './ConfirmDialog.js';
import { showToast } from './Toast.js';

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
  if (indicator === 'downtime') return formatDurationLong(value);
  return fmtPercent(value);
}

function barWidth(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric * 100));
}

function loadTone(value) {
  if (value === null || value === undefined) return 'bar--normal';
  if (value >= 1) return 'bar--bottleneck';
  if (value >= 0.85) return 'bar--tight';
  return 'bar--normal';
}

function oeeTone(value) {
  if (value === null || value === undefined) return 'bar--normal';
  if (value < 0.4) return 'bar--bottleneck';
  if (value < 0.6) return 'bar--tight';
  return 'bar--normal';
}

function downtimeTone(share) {
  if (share >= 0.5) return 'bar--bottleneck';
  if (share >= 0.25) return 'bar--tight';
  return 'bar--normal';
}

const PRIORITY_LABEL = { low: 'Baja', normal: 'Normal', high: 'Alta' };

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @param {{role?: string}} [options]
 * @returns {HTMLElement}
 */
export function PlantPerformancePanel(store, options = {}) {
  let periodKey = 'october';
  let role = options.role || 'plant_manager';

  const root = el(`
    <section class="view plant-view">
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
      <div data-role="body"></div>
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

    const thresholdHint = (indicator) => {
      const setting = data.thresholds.find((row) => row.indicator === indicator);
      if (!setting || setting.threshold === null) return 'Sin umbral configurado';
      const comparison = setting.comparison === 'gt' ? '>' : '<';
      return `Umbral ${comparison} ${formatIndicator(indicator, setting.threshold)}`;
    };

    const kpis = ['load', 'oee', 'downtime', 'fulfillment']
      .map(
        (indicator) => `
        <article class="kpi-card" data-kpi="${indicator}">
          <span class="kpi-card__label">${INDICATOR_LABEL[indicator]}</span>
          <span class="kpi-card__value">${formatIndicator(indicator, data.indicators[indicator])}</span>
          <span class="kpi-card__hint">${thresholdHint(indicator)}</span>
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
          <td class="cell--nowrap">${load.invalid_capacity ? '—' : `${fmtNumber(load.load_minutes, 2)} / ${fmtNumber(load.capacity_minutes, 2)}`}</td>
          <td class="cell--nowrap">${load.load_ratio === null ? '—' : fmtPercent(load.load_ratio)}</td>
          <td class="cell--nowrap">${oee && oee.oee !== null ? fmtPercent(oee.oee) : '—'}</td>
        </tr>`;
      })
      .join('');

    const centerChart = store.workCenters
      .map((workCenter) => {
        const load = data.load_by_work_center[workCenter.id];
        const oee = data.oee_by_work_center[workCenter.id];
        const loadValue = load && !load.invalid_capacity ? load.load_ratio : null;
        const oeeValue = oee && oee.oee !== null ? oee.oee : null;
        const name = escapeHtml(workCenter.name);
        const loadText = loadValue === null ? '—' : fmtPercent(loadValue);
        const oeeText = oeeValue === null ? '—' : fmtPercent(oeeValue);
        return `<div class="plant-chart__row" data-chart-wc="${escapeHtml(workCenter.id)}">
          <span class="plant-chart__name">${name}</span>
          <div class="plant-chart__bars">
            <div class="balance-chart__track" role="img" aria-label="${name}: carga ${loadText}">
              <div class="balance-chart__fill ${loadTone(loadValue)}" style="width:${barWidth(loadValue)}%"></div>
            </div>
            <div class="balance-chart__track" role="img" aria-label="${name}: OEE ${oeeText}">
              <div class="balance-chart__fill ${oeeTone(oeeValue)}" style="width:${barWidth(oeeValue)}%"></div>
            </div>
          </div>
          <div class="plant-chart__values">
            <span>Carga ${loadText}</span>
            <span>OEE ${oeeText}</span>
          </div>
        </div>`;
      })
      .join('');

    const downtimeRows = data.downtime_by_reason.length
      ? data.downtime_by_reason
          .map(
            (row) =>
              `<tr data-downtime="${escapeHtml(row.reason_id)}"><td>${escapeHtml(row.reason_label)}</td><td class="cell--nowrap">${formatDurationLong(row.downtime_minutes)}</td></tr>`,
          )
          .join('')
      : '<tr><td colspan="2" class="empty-cell">Sin paradas cerradas en el período.</td></tr>';

    const downtimeMax = data.downtime_by_reason.reduce(
      (max, row) => Math.max(max, Number(row.downtime_minutes) || 0),
      0,
    );
    const downtimeChart = data.downtime_by_reason.length
      ? data.downtime_by_reason
          .map((row) => {
            const share = downtimeMax > 0 ? (Number(row.downtime_minutes) || 0) / downtimeMax : 0;
            const label = escapeHtml(row.reason_label);
            const minutesText = formatDurationLong(row.downtime_minutes);
            return `<div class="plant-chart__row" data-downtime-chart="${escapeHtml(row.reason_id)}">
              <span class="plant-chart__name">${label}</span>
              <div class="balance-chart__track" role="img" aria-label="${label}: ${minutesText}">
                <div class="balance-chart__fill ${downtimeTone(share)}" style="width:${barWidth(share)}%"></div>
              </div>
              <span class="balance-chart__label">${minutesText}</span>
            </div>`;
          })
          .join('')
      : '<p class="empty-note">Sin paradas cerradas en el período.</p>';

    const actionOrders = store.productionOrders.filter(
      (order) => order.status !== 'completed' && order.status !== 'cancelled',
    );
    const orderRows = actionOrders
      .map((order) => {
        const priorityDisabled = !canChangePriority || order.status !== 'planned';
        return `<tr data-order="${escapeHtml(order.id)}">
          <td>${escapeHtml(order.order_number)}</td>
          <td>${escapeHtml(ORDER_STATUS_LABEL[order.status] || order.status)}</td>
          <td>
            <select class="priority-select" data-priority="${escapeHtml(order.id)}" ${priorityDisabled ? 'disabled' : ''}>
              ${['low', 'normal', 'high']
                .map(
                  (priority) =>
                    `<option value="${priority}" ${order.priority === priority ? 'selected' : ''}>${PRIORITY_LABEL[priority]}</option>`,
                )
                .join('')}
            </select>
          </td>
          <td><button type="button" class="btn btn--tiny btn--danger" data-cancel="${escapeHtml(order.id)}" ${canCancel ? '' : 'disabled'}>Cancelar</button></td>
        </tr>`;
      })
      .join('');

    bodyEl.innerHTML = `
      <div class="kpi-grid">${kpis}</div>
      <div class="panel-grid">
        <article class="panel">
          <header class="panel__header"><h3>Alertas de umbral</h3></header>
          <ul class="alarm-list">${alarmRows}</ul>
        </article>
        <article class="panel">
          <header class="panel__header"><h3>Configurar umbral</h3></header>
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
        </article>
      </div>
      <article class="panel">
        <header class="panel__header"><h3>Carga y OEE por centro</h3></header>
        <div class="plant-chart plant-chart--centers" role="group" aria-label="Barras de carga y OEE por centro">
          ${centerChart}
        </div>
        <div class="table-wrap table-wrap--plant">
          <table class="data-table plant-table">
            <thead><tr><th>Centro</th><th title="Capacidad del período = días hábiles × min/día × eficiencia">Carga / capacidad (min)</th><th title="Carga del período ÷ capacidad del período">Utilización</th><th>OEE</th></tr></thead>
            <tbody>${centerRows}</tbody>
          </table>
        </div>
      </article>
      <article class="panel">
        <header class="panel__header"><h3>Paradas por motivo</h3></header>
        <div class="plant-chart plant-chart--downtime" role="group" aria-label="Barras de paradas por motivo">
          ${downtimeChart}
        </div>
        <div class="table-wrap table-wrap--plant">
          <table class="data-table plant-table">
            <thead><tr><th>Motivo</th><th>Minutos</th></tr></thead>
            <tbody>${downtimeRows}</tbody>
          </table>
        </div>
      </article>
      <article class="panel">
        <header class="panel__header"><h3>Acciones sobre órdenes</h3></header>
        <div class="table-wrap table-wrap--plant">
          <table class="data-table plant-table">
            <thead><tr><th>Orden</th><th>Estado</th><th>Prioridad</th><th></th></tr></thead>
            <tbody>${orderRows || '<tr><td colspan="4" class="empty-cell">Sin órdenes accionables.</td></tr>'}</tbody>
          </table>
        </div>
      </article>`;

    bodyEl.querySelectorAll('[data-priority]').forEach((select) => {
      select.addEventListener('change', async () => {
        try {
          store.changeOrderPriority(select.getAttribute('data-priority'), select.value);
          showToast('Prioridad actualizada', { tone: 'success' });
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
        showToast('Umbral actualizado', { tone: 'success' });
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
        showToast('Orden cancelada', { tone: 'warning' });
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
      showToast('Reporte generado', { tone: 'info' });
    });
  }
  roleEl.value = role;
  store.addEventListener('change', render);
  render();
  return root;
}
