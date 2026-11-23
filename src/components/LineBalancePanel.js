/**
 * @file Balance de líneas (US-11): KPIs de planta, carga vs. capacidad,
 * estados semánticos por centro y detalle por orden en secuencia de ruta.
 */

import { escapeHtml, el, fmtNumber, fmtPercent } from './format.js';
import { businessDaysInPeriod } from '../domain/capacity.js';
import { utilizationStatus } from '../domain/line-balance.js';

const PERIODS = {
  october: { from: '2026-10-01', to: '2026-10-31', label: 'Octubre 2026' },
  november: { from: '2026-11-01', to: '2026-11-30', label: 'Noviembre 2026' },
  all: { from: '2026-10-01', to: '2026-11-30', label: 'Todo el historial' },
};

const STATUS = {
  normal: { label: 'Normal · verde', badge: 'badge--success', bar: 'bar--normal' },
  tight: { label: 'Ajustada · ámbar', badge: 'badge--warn', bar: 'bar--tight' },
  bottleneck: { label: 'Cuello crítico · rojo', badge: 'badge--danger', bar: 'bar--bottleneck' },
  unknown: { label: 'Sin datos', badge: 'badge--muted', bar: 'bar--normal' },
};

const CHART_SCALE = 1.2;

function formatMinutes(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return '—';
  return `<span class="minutes-main">${fmtNumber(value, 0)} min</span> <span class="minutes-hours">(${fmtNumber(value / 60, 1)} h)</span>`;
}

function statusBadge(status) {
  const config = STATUS[status] || STATUS.unknown;
  return `<span class="badge ${config.badge}">${config.label}</span>`;
}

function utilizationCell(row) {
  if (row.utilization === null || row.utilization === undefined) return '—';
  const width = Math.min(100, Math.max(0, row.utilization * 100));
  const config = STATUS[row.status] || STATUS.unknown;
  return `<div class="cell--bar">
    <div class="bar ${config.bar}"><div class="bar__fill" style="width:${width}%"></div></div>
    <span class="bar__label">${fmtPercent(row.utilization)}</span>
  </div>`;
}

function workCenterName(store, id) {
  return store.workCenters.find((center) => center.id === id)?.name || id;
}

function suggestionDescription(store, suggestion) {
  const order = store.orderById(suggestion.order_id);
  const orderNumber = escapeHtml(order?.order_number || suggestion.order_id || '—');
  const from = escapeHtml(workCenterName(store, suggestion.from_work_center_id));
  const sequence =
    suggestion.sequence === null || suggestion.sequence === undefined
      ? ''
      : ` · Sec. ${suggestion.sequence}`;
  if (suggestion.type === 'sequence') {
    return `Revisar la secuencia de ${orderNumber} en ${from}${sequence} antes de mover operaciones.`;
  }
  const to = escapeHtml(workCenterName(store, suggestion.to_work_center_id));
  return `Reasignar ${fmtNumber(suggestion.minutes, 0)} min de ${orderNumber} desde ${from} a ${to}${sequence}.`;
}

function centerPopoverMarkup(store, balance, center) {
  const orderMinutes = balance.load_by_work_center[center.work_center_id]?.order_minutes || {};
  const orders = Object.entries(orderMinutes)
    .map(([orderId, minutes]) => ({
      id: orderId,
      number: store.orderById(orderId)?.order_number || orderId,
      minutes,
    }))
    .sort((a, b) => b.minutes - a.minutes);
  const rows = orders.length
    ? orders
        .map(
          (order) => `<tr data-center-popover-order="${order.id}">
            <td>${escapeHtml(order.number)}</td>
            <td class="num">${formatMinutes(order.minutes)}</td>
            <td class="num">${fmtPercent(center.load_minutes ? order.minutes / center.load_minutes : 0)}</td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="3" class="empty-cell">Sin órdenes que consuman este centro.</td></tr>';

  return `<div class="center-popover" id="center-orders-popover" data-role="center-popover" role="dialog" aria-label="Órdenes de ${escapeHtml(center.name)}">
    <header class="center-popover__header">
      <div>
        <p class="center-popover__title">Órdenes de ${escapeHtml(center.name)}</p>
        <p class="center-popover__meta">Carga en el centro: ${formatMinutes(center.load_minutes)}</p>
      </div>
      <button type="button" class="btn btn--tiny" data-role="close-popover" aria-label="Cerrar detalle de órdenes">Cerrar</button>
    </header>
    <table class="data-table data-table--compact center-popover__table">
      <thead><tr><th>Orden</th><th class="num">Carga en el centro</th><th class="num">Participación</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function kpiCards(balance, period) {
  const summary = balance.summary;
  const top = summary.most_loaded;
  const efficiency =
    summary.balancing_efficiency === null ? '—' : fmtPercent(summary.balancing_efficiency);
  return `
    <article class="kpi-card kpi-card--compact" data-kpi="avg-utilization">
      <span class="kpi-card__label">Utilización promedio de planta</span>
      <span class="kpi-card__value">${summary.average_utilization === null ? '—' : fmtPercent(summary.average_utilization)}</span>
      <span class="kpi-card__hint">${summary.work_center_count} centros · ${escapeHtml(period.label)}</span>
    </article>
    <article class="kpi-card kpi-card--compact" data-kpi="top-center">
      <span class="kpi-card__label">Estación más cargada</span>
      <span class="kpi-card__value kpi-card__inline">${top ? escapeHtml(top.name) : '—'}${top ? statusBadge(top.status) : ''}</span>
      <span class="kpi-card__hint">${top ? `${fmtPercent(top.utilization)} de su capacidad` : 'Sin capacidad válida'}</span>
    </article>
    <article class="kpi-card kpi-card--compact" data-kpi="balance-efficiency">
      <span class="kpi-card__label">Eficiencia de balanceo</span>
      <span class="kpi-card__value">${efficiency}</span>
      <span class="kpi-card__hint">(Σ cargas / (centros × carga máx.)) × 100</span>
    </article>
    <article class="kpi-card kpi-card--compact" data-kpi="free-capacity">
      <span class="kpi-card__label">Capacidad libre total</span>
      <span class="kpi-card__value">${fmtNumber(summary.free_capacity_minutes / 60, 1)} h</span>
      <span class="kpi-card__hint">${fmtNumber(summary.free_capacity_minutes)} min disponibles</span>
    </article>`;
}

function chartRows(rows) {
  return rows
    .map((row) => {
      const name = escapeHtml(row.name);
      if (row.utilization === null || row.utilization === undefined) {
        return `<div class="balance-chart__row" data-chart-wc="${row.work_center_id}">
          <span>${name}</span><div class="balance-chart__track"></div>
          <span class="balance-chart__label">—</span>
        </div>`;
      }
      const config = STATUS[row.status] || STATUS.unknown;
      const width = Math.min(100, Math.max(0, (row.utilization / CHART_SCALE) * 100));
      return `<div class="balance-chart__row" data-chart-wc="${row.work_center_id}">
        <span>${name}</span>
        <div class="balance-chart__track">
          <div class="balance-chart__fill ${config.bar}" style="width:${width}%"></div>
          <span class="balance-chart__ref"></span>
        </div>
        <span class="balance-chart__label">${fmtPercent(row.utilization)}</span>
      </div>`;
    })
    .join('');
}

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @returns {HTMLElement}
 */
export function LineBalancePanel(store) {
  let periodKey = 'october';
  let selectedOrderId = '';
  let selectedWorkCenterId = '';
  let popoverCenterId = '';
  let focusPopover = false;
  const acceptedSuggestions = new Set();

  const root = el(`
    <section class="view">
      <header class="view__header">
        <div>
          <h1>Balance de Líneas</h1>
          <p class="view__subtitle">Carga proyectada vs. capacidad efectiva. Solo contexto operacional — no evaluación de desempeño.</p>
        </div>
        <div class="inline-actions">
          <label class="inline-field">Período
            <select data-role="period">
              <option value="october">Octubre 2026</option>
              <option value="november">Noviembre 2026</option>
              <option value="all">Todo el historial</option>
            </select>
          </label>
          <span class="badge badge--success" data-bottleneck role="status" aria-live="polite">Línea balanceada · Sin cuellos de botella críticos</span>
        </div>
      </header>
      <div class="kpi-grid kpi-grid--compact" data-role="kpis"></div>
      <div data-role="body"></div>
      <div class="center-popover-root" data-role="popover-root"></div>
      <div data-role="modal-root"></div>
    </section>`);

  const bodyEl = root.querySelector('[data-role="body"]');
  const kpisEl = root.querySelector('[data-role="kpis"]');
  const periodEl = root.querySelector('[data-role="period"]');
  const bottleneckEl = root.querySelector('[data-bottleneck]');
  const popoverRoot = root.querySelector('[data-role="popover-root"]');
  const modalRoot = root.querySelector('[data-role="modal-root"]');

  function positionPopover() {
    const section = bodyEl.querySelector('[data-role="load-section"]');
    const popover = popoverRoot.querySelector('[data-role="center-popover"]');
    if (!section || !popover) return;
    const row = [...bodyEl.querySelectorAll('tr[data-wc]')].find(
      (item) => item.dataset.wc === popoverCenterId,
    );
    const sectionRect = section.getBoundingClientRect();
    const rowRect = row?.getBoundingClientRect?.() ?? sectionRect;
    const viewportWidth = window.innerWidth || 1024;
    const viewportHeight = window.innerHeight || 768;
    const width = popover.offsetWidth || 420;
    const height = popover.offsetHeight || 260;
    const centeredLeft = sectionRect.left + sectionRect.width / 2 - width / 2;
    const left = Math.max(16, Math.min(centeredLeft, viewportWidth - width - 16));
    const top = Math.max(16, Math.min(rowRect.top, viewportHeight - height - 16));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function closePopover(restoreFocus = false) {
    const previousCenterId = popoverCenterId;
    if (!previousCenterId && !selectedWorkCenterId) return;
    selectedWorkCenterId = '';
    popoverCenterId = '';
    focusPopover = false;
    render();
    if (restoreFocus && previousCenterId) {
      const anchor = [...bodyEl.querySelectorAll('tr[data-wc]')].find(
        (row) => row.dataset.wc === previousCenterId,
      );
      anchor?.focus();
    }
  }

  function render() {
    const period = PERIODS[periodKey];
    const balance = store.lineBalanceFor(period);
    const businessDays = businessDaysInPeriod(period);
    const dailyUtilization = new Map(
      store.dailyUtilizationByWorkCenter().map((row) => [row.workCenter.id, row.utilization]),
    );

    if (balance.bottleneck) {
      bottleneckEl.className = 'badge badge--danger';
      bottleneckEl.textContent = `Alerta crítica · Cuello de botella: ${balance.bottleneck.name} (${fmtPercent(balance.bottleneck.utilization)})`;
    } else {
      bottleneckEl.className = 'badge badge--success';
      bottleneckEl.textContent = 'Línea balanceada · Sin cuellos de botella críticos';
    }

    kpisEl.innerHTML = kpiCards(balance, period);

    const rows = balance.utilization_by_work_center
      .map((row) => {
        const standard = balance.standard_times[row.work_center_id];
        const isBottleneck = row.status === 'bottleneck';
        const isSelected = selectedWorkCenterId === row.work_center_id;
        const deficit = row.slack_minutes < 0 ? ' cell--deficit' : '';
        const popoverOpen = popoverCenterId === row.work_center_id;
        const dailyUtil = dailyUtilization.get(row.work_center_id);
        const dailyRow = { utilization: dailyUtil, status: utilizationStatus(dailyUtil) };
        return `<tr data-wc="${escapeHtml(row.work_center_id)}" data-status="${row.status}" tabindex="0" role="button" aria-pressed="${isSelected}" aria-expanded="${popoverOpen}" ${popoverOpen ? 'aria-controls="center-orders-popover"' : ''} class="status--${row.status}${isBottleneck ? ' is-bottleneck' : ''}${isSelected ? ' is-selected' : ''}">
          <td class="balance-center"><span class="balance-center__name">${escapeHtml(row.name)}</span>${statusBadge(row.status)}</td>
          <td class="num">${formatMinutes(row.load_minutes)}</td>
          <td class="num">${formatMinutes(row.capacity_minutes)}</td>
          <td class="num" title="Capacidad efectiva de 1 día = min/día × eficiencia; se multiplica por los días hábiles del período">${row.effective_per_day_minutes === null ? '—' : formatMinutes(row.effective_per_day_minutes)}</td>
          <td class="num${deficit}">${formatMinutes(row.slack_minutes)}</td>
          <td>${utilizationCell(row)}</td>
          <td title="Carga pendiente ÷ capacidad de 1 día, igual que en el Panel de Producción">${utilizationCell(dailyRow)}</td>
          <td class="num">${standard ? fmtNumber(standard.setup_time_minutes, 0) : '—'}</td>
          <td class="num">${standard ? fmtNumber(standard.run_time_per_unit_minutes, 2) : '—'}</td>
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

    const selectedCenter = balance.utilization_by_work_center.find(
      (row) => row.work_center_id === selectedWorkCenterId,
    );
    if (!selectedCenter) {
      selectedWorkCenterId = '';
      popoverCenterId = '';
      popoverRoot.innerHTML = '';
    }

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
            const linked = row.work_center_id === selectedWorkCenterId ? ' is-selected' : '';
            const emptyLoad = !load || Number(load.load_minutes) === 0 ? ' is-empty-load' : '';
            const sequence =
              row.sequence === null || row.sequence === undefined ? '—' : `Sec. ${row.sequence}`;
            return `<tr data-order-wc="${escapeHtml(row.work_center_id)}" data-sequence="${row.sequence ?? ''}" class="${linked}${emptyLoad}">
              <td><span class="order-sequence">${sequence}</span>${escapeHtml(row.name)}</td>
              <td class="num">${formatMinutes(load ? load.load_minutes : 0)}</td>
              <td>${row.utilization === null ? '—' : fmtPercent(row.utilization)}</td>
            </tr>`;
          })
          .join('')
      : '';

    const requestPeriodKey = `${period.from}:${period.to}`;
    const suggestionRows = balance.suggestions.length
      ? balance.suggestions
          .map((suggestion) => {
            const accepted = acceptedSuggestions.has(
              `${requestPeriodKey}|${suggestion.suggestion_id}`,
            );
            const typeLabel = suggestion.type === 'sequence' ? 'Secuencia' : 'Reasignación';
            const typeBadge =
              suggestion.type === 'sequence' ? 'badge--type-sequence' : 'badge--type-reassign';
            return `<tr data-suggestion="${suggestion.suggestion_id}">
              <td><span class="badge ${typeBadge}">${typeLabel}</span></td>
              <td>${suggestionDescription(store, suggestion)}</td>
              <td class="num">${fmtNumber(suggestion.minutes, 0)} min</td>
              <td>${
                accepted
                  ? '<span class="badge badge--simulated">Solicitud simulada</span>'
                  : `<button type="button" class="btn btn--tiny btn--request" data-request="${suggestion.suggestion_id}">Solicitar</button>`
              }</td>
            </tr>`;
          })
          .join('')
      : '<tr><td colspan="4" class="empty-cell">Sin cuellos de botella críticos: no hay reasignaciones pendientes.</td></tr>';

    bodyEl.innerHTML = `
      <article class="panel" data-role="load-section">
        <header class="panel__header">
          <h3>Carga por centro · ${escapeHtml(period.label)} (${fmtNumber(businessDays)} días hábiles)</h3>
          <p class="panel__subtitle" data-unscheduled>Órdenes sin fechas excluidas: ${unscheduled.length} (${escapeHtml(unscheduledText)})</p>
          <p class="panel__subtitle">Capacidad = días hábiles × min/día × factor de eficiencia. Haz clic en un centro para ver sus órdenes en una ventana compacta.</p>
        </header>
        <div class="panel__body">
          <div class="table-wrap">
            <table class="data-table balance-table">
              <thead>
                <tr><th>Centro</th><th>Carga (min)</th><th>Capacidad (min)</th><th>Capacidad efectiva/día</th><th>Holgura (min)</th><th>Utilización</th><th>Utilización del día</th><th>Setup estándar</th><th>Run estándar /u</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </article>
      <article class="panel">
        <header class="panel__header">
          <h3>Carga vs. capacidad</h3>
          <p class="panel__subtitle">Referencia: 100% de capacidad nominal. Normal &lt; 75% · Ajustada 75–94% · Cuello ≥ 95%.</p>
        </header>
        <div class="balance-chart" data-role="balance-chart">
          ${chartRows(balance.utilization_by_work_center)}
        </div>
      </article>
      <article class="panel">
        <header class="panel__header">
          <h3>Sugerencias de balanceo</h3>
          <p class="panel__subtitle" data-role="suggestions-note">Propuestas simuladas: al aceptarlas solo se marca la fila en esta vista; no se registra, persiste ni cambia rutas, operaciones o asignaciones.</p>
        </header>
        <div class="table-wrap table-wrap--full" data-role="balance-suggestions">
          <table class="data-table data-table--compact">
            <thead><tr><th>Tipo</th><th>Propuesta</th><th class="num">Carga</th><th>Acción</th></tr></thead>
            <tbody>${suggestionRows}</tbody>
          </table>
        </div>
      </article>
      <article class="panel">
        <header class="panel__header">
          <h3>Detalle por orden</h3>
          <p class="panel__subtitle" data-role="order-filter-note">${selectedCenter ? `Resaltado: ${escapeHtml(selectedCenter.name)}` : 'Filas ordenadas por secuencia de la ruta de fabricación.'}</p>
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
        <div class="panel__body">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Centro</th><th>Carga de la orden (min)</th><th>Utilización del período</th></tr></thead>
              <tbody>${orderRows || '<tr><td colspan="3" class="empty-cell">Sin orden seleccionada.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </article>`;

    if (selectedCenter && popoverCenterId === selectedCenter.work_center_id) {
      popoverRoot.innerHTML = centerPopoverMarkup(store, balance, selectedCenter);
      positionPopover();
      popoverRoot
        .querySelector('[data-role="close-popover"]')
        .addEventListener('click', (event) => {
          event.stopPropagation();
          closePopover(true);
        });
      if (focusPopover) {
        popoverRoot.querySelector('[data-role="close-popover"]').focus();
        focusPopover = false;
      }
    } else {
      popoverRoot.innerHTML = '';
    }

    bodyEl.querySelectorAll('tr[data-wc]').forEach((row) => {
      const toggle = (event) => {
        event?.stopPropagation?.();
        if (popoverCenterId === row.dataset.wc) {
          closePopover();
          return;
        }
        selectedWorkCenterId = row.dataset.wc;
        popoverCenterId = row.dataset.wc;
        focusPopover = true;
        render();
      };
      row.addEventListener('click', toggle);
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle(event);
        }
      });
    });

    const orderSelect = bodyEl.querySelector('[data-role="order-select"]');
    if (orderSelect) {
      orderSelect.addEventListener('change', () => {
        selectedOrderId = orderSelect.value;
        render();
      });
    }

    for (const button of bodyEl.querySelectorAll('[data-request]')) {
      button.addEventListener('click', () => {
        const suggestion = balance.suggestions.find(
          (item) => item.suggestion_id === button.dataset.request,
        );
        if (suggestion) openRequest(suggestion, period);
      });
    }
  }

  function openRequest(suggestion, period) {
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-role="request-modal">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="balance-request-title">
          <h2 id="balance-request-title">Aceptar solicitud de balanceo</h2>
          <p class="panel__subtitle">${suggestionDescription(store, suggestion)} Simulación: la nota no se envía ni se guarda.</p>
          <form class="stack-form" data-role="request-form">
            <label>Nota de la solicitud
              <textarea name="notes" rows="3" placeholder="Motivo de la reasignación o cambio de secuencia"></textarea>
            </label>
            <p class="form-error" data-role="request-error" role="alert"></p>
            <div class="modal-actions">
              <button type="button" class="btn" data-role="dismiss-request">Cancelar</button>
              <button type="submit" class="btn btn--primary">Aceptar solicitud</button>
            </div>
          </form>
        </div>
      </div>`;
    const close = () => {
      modalRoot.innerHTML = '';
    };
    modalRoot.querySelector('[data-role="dismiss-request"]').addEventListener('click', close);
    modalRoot.querySelector('[role="dialog"]').addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
    const form = modalRoot.querySelector('[data-role="request-form"]');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const requestPeriodKey = `${period.from}:${period.to}`;
      acceptedSuggestions.add(`${requestPeriodKey}|${suggestion.suggestion_id}`);
      close();
      render();
    });
    modalRoot.querySelector('textarea').focus();
  }

  document.addEventListener('click', (event) => {
    if (!popoverCenterId) return;
    if (event.target.closest?.('[data-role="center-popover"], [data-wc]')) return;
    closePopover();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !popoverCenterId) return;
    if (modalRoot.querySelector('[data-role="request-modal"]')) return;
    closePopover(true);
  });

  window.addEventListener('resize', () => {
    if (popoverCenterId) positionPopover();
  });

  window.addEventListener(
    'scroll',
    () => {
      if (popoverCenterId) positionPopover();
    },
    true,
  );

  periodEl.addEventListener('change', () => {
    periodKey = periodEl.value;
    selectedWorkCenterId = '';
    popoverCenterId = '';
    focusPopover = false;
    render();
  });
  store.addEventListener('change', render);
  render();
  return root;
}
