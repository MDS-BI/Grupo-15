/**
 * @file Estación de trabajo del operador (US-06): botón alterno, cronómetro,
 * atrasos justificados y contadores de turno/acumulado.
 */

import { escapeHtml, el, fmtNumber, OP_STATUS_LABEL } from './format.js';
import { elapsedMinutes, sumClosedDelayMinutes } from '../domain/shift-tracking.js';
import { DelayCorrectionDialog } from './DelayCorrectionDialog.js';
import { decimalInput, parseDecimal } from './numeric-field.js';

function formatDelayStart(iso) {
  const text = String(iso ?? '');
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(text);
  return match ? `${match[3]}/${match[2]} ${match[4]}:${match[5]}` : text;
}

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @returns {HTMLElement}
 */
export function OperatorWorkstationPanel(store) {
  let selectedOperationId = null;

  const root = el(`
    <section class="view">
      <header class="view__header">
        <div>
          <h1>Estación del Operador</h1>
          <p class="view__subtitle">Turno, atrasos y piezas. Solo contexto operacional — no evaluación de desempeño.</p>
        </div>
        <label class="inline-field">Operación
          <select data-role="operation-select"></select>
        </label>
      </header>
      <div data-role="body"></div>
      <div class="modal-root" data-role="modal-root"></div>
    </section>`);

  const selectEl = root.querySelector('[data-role="operation-select"]');
  const bodyEl = root.querySelector('[data-role="body"]');
  const modalRoot = root.querySelector('[data-role="modal-root"]');

  function operations() {
    return store.productionOrderOperations.filter(
      (op) => op.status !== 'completed' || store.openDelayFor(op.id),
    );
  }

  function renderSelect() {
    const list = operations();
    if (!selectedOperationId || !list.some((op) => op.id === selectedOperationId)) {
      selectedOperationId = list[0] ? list[0].id : null;
    }
    selectEl.innerHTML = list
      .map((op) => {
        const order = store.orderById(op.production_order_id);
        return `<option value="${escapeHtml(op.id)}">${escapeHtml(order ? order.order_number : op.production_order_id)} · op ${escapeHtml(op.sequence)} (${OP_STATUS_LABEL[op.status]})</option>`;
      })
      .join('');
    if (selectedOperationId) selectEl.value = selectedOperationId;
  }

  function renderBody() {
    const operation = store.productionOrderOperations.find((op) => op.id === selectedOperationId);
    if (!operation) {
      bodyEl.innerHTML = '<p class="empty-note">Sin operaciones para registrar turno.</p>';
      return;
    }
    const order = store.orderById(operation.production_order_id);
    const plannedQuantity = Number(order?.quantity_planned) || 0;
    const cumulativePercent =
      plannedQuantity > 0
        ? Math.min(100, Math.max(0, (Number(operation.quantity_completed) / plannedQuantity) * 100))
        : 0;
    const atLimit = Number(operation.quantity_completed) >= plannedQuantity;
    const shift = store.activeShiftFor(operation.id);
    const openDelay = store.openDelayFor(operation.id);
    const delays = store.delaysForOperation(operation.id);
    const workCenter = store.workCenterById(operation.work_center_id);

    let timerMinutes = 0;
    if (shift && shift.status === 'in_progress') {
      try {
        timerMinutes = Math.max(
          0,
          elapsedMinutes(shift.started_at, new Date().toISOString()) -
            sumClosedDelayMinutes(delays),
        );
      } catch {
        timerMinutes = 0;
      }
    }

    const reasons = shift ? store.reasonsForShift(shift.id) : [];
    const reasonOptions = reasons
      .map(
        (reason) => `<option value="${escapeHtml(reason.id)}">${escapeHtml(reason.label)}</option>`,
      )
      .join('');

    const delayRows = delays
      .map((delay) => {
        const reason = store.delayReasons.find((row) => row.id === delay.delay_reason_id);
        return `<tr data-delay-row="${escapeHtml(delay.id)}">
          <td>${escapeHtml(reason ? reason.label : delay.delay_reason_id)}</td>
          <td class="delay-start" title="${escapeHtml(delay.started_at)}">${escapeHtml(formatDelayStart(delay.started_at))}</td>
          <td>${delay.duration_minutes != null ? fmtNumber(delay.duration_minutes, 2) : 'Abierto'}</td>
          <td>${delay.status === 'open' ? '<span class="badge badge--warn badge--delay-open">Abierto — pendiente de corrección</span>' : 'Cerrado'}</td>
        </tr>`;
      })
      .join('');

    const toggleText =
      operation.status === 'completed'
        ? 'Finalizada'
        : operation.status === 'in_progress'
          ? 'Finalizar'
          : 'Iniciar';

    bodyEl.innerHTML = `
      <div class="operator-layout">
        <article class="panel operator-panel operator-panel--operation">
          <header class="panel__header">
            <h2>${escapeHtml(order ? order.order_number : operation.production_order_id)} · ${escapeHtml(workCenter ? workCenter.name : operation.work_center_id)}</h2>
            <p class="panel__subtitle">${escapeHtml(store.productById(order?.product_id)?.name || '')}</p>
          </header>
          <div class="operator-summary">
            <div class="mini-stat"><span class="mini-stat__value" data-role="timer">${fmtNumber(timerMinutes, 2)} min</span><span class="mini-stat__label">Tiempo efectivo del turno</span></div>
            <div class="mini-stat"><span class="mini-stat__value">${fmtNumber(operation.planned_time_minutes)}</span><span class="mini-stat__label">Tiempo planificado</span></div>
            <div class="mini-stat"><span class="mini-stat__value">${fmtNumber(operation.delay_time_minutes || 0, 2)}</span><span class="mini-stat__label">Atrasos cerrados</span></div>
            <div class="mini-stat"><span class="mini-stat__value">${fmtNumber(operation.quantity_completed)} / ${fmtNumber(plannedQuantity)}</span><span class="mini-stat__label">Avance acumulado</span></div>
          </div>
          <div class="detail-actions">
            <button type="button" class="btn btn--primary btn--block" data-role="toggle" aria-pressed="${operation.status === 'in_progress'}" ${operation.status === 'completed' ? 'disabled' : ''}>${toggleText}</button>
          </div>
          <p class="form-error" data-role="error" role="alert"></p>
        </article>

        <article class="panel operator-panel operator-panel--counters">
          <header class="panel__header"><h3>Contadores</h3></header>
          <div class="counter-blocks">
            <div class="counter-block counter-block--shift">
              <p class="counter-block__label">Turno: <strong class="counter-block__value" data-role="shift-counter">${fmtNumber(shift ? shift.quantity_counted : 0)}</strong></p>
              <div class="counter-controls">
                <button type="button" class="btn btn--counter" data-counter="dec">−</button>
                ${decimalInput({ name: 'counter', value: String(shift ? shift.quantity_counted : 0), min: 0, decimals: 0, label: 'El contador del turno', extra: `data-role="counter-input" ${shift ? '' : 'disabled'}` })}
                <button type="button" class="btn btn--counter" data-counter="inc" ${atLimit ? 'disabled' : ''}>+</button>
                <button type="button" class="btn btn--tiny" data-role="set-counter" ${shift ? '' : 'disabled'}>Fijar</button>
              </div>
            </div>
            <div class="counter-block counter-block--cumulative">
              <p class="counter-block__label">Acumulado: <strong data-role="cumulative-counter">${fmtNumber(operation.quantity_completed)}</strong> / ${fmtNumber(plannedQuantity)}</p>
              <div class="bar counter-progress" aria-hidden="true"><div class="bar__fill" style="width: ${cumulativePercent}%"></div></div>
            </div>
          </div>
        </article>

        <article class="panel operator-panel operator-panel--delays">
          <header class="panel__header"><h3>Atrasos justificados</h3></header>
          <div class="table-wrap">
            <table class="data-table data-table--compact operator-delay-table">
              <thead><tr><th>Motivo</th><th>Inicio</th><th>Duración</th><th>Estado</th></tr></thead>
              <tbody>${delayRows || '<tr><td colspan="4" class="empty-cell">Sin atrasos.</td></tr>'}</tbody>
            </table>
          </div>
          <div class="stack-form">
            <div class="delay-form-grid">
              <label>Motivo
                <select data-role="delay-reason" ${shift ? '' : 'disabled'}>
                  <option value="">Selecciona…</option>${reasonOptions}
                  <option value="__custom">Nuevo motivo…</option>
                </select>
              </label>
              <label>Motivo personalizado
                <input type="text" data-role="custom-label" placeholder="Etiqueta del motivo" />
              </label>
            </div>
            <label>Nota
              <input type="text" data-role="delay-note" placeholder="Detalle opcional" />
            </label>
            <div class="detail-actions delay-form-actions">
              <button type="button" class="btn" data-role="start-delay" ${shift && !openDelay ? '' : 'disabled'}>Registrar atraso</button>
              <button type="button" class="btn btn--primary" data-role="close-delay" ${openDelay ? '' : 'disabled'}>Finalizar atraso</button>
              <button type="button" class="btn" data-role="correct-delay" ${operation.status === 'completed' && openDelay ? '' : 'disabled'}>Corregir atraso abierto</button>
            </div>
          </div>
          <p class="form-error" data-role="delay-error" role="alert"></p>
        </article>
      </div>`;

    const errorEl = bodyEl.querySelector('[data-role="error"]');
    const delayError = bodyEl.querySelector('[data-role="delay-error"]');

    bodyEl.querySelector('[data-role="toggle"]').addEventListener('click', () => {
      try {
        if (operation.status === 'in_progress') {
          openFinishConfirmation(operation);
          return;
        }
        const assignment = store.activeAssignmentForWorkCenter(operation.work_center_id);
        store.startShift(operation.id, {
          operator_id: assignment ? assignment.ext_hr_employee_id : null,
        });
        render();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });

    const reasonSelect = bodyEl.querySelector('[data-role="delay-reason"]');
    reasonSelect.addEventListener('change', () => {
      bodyEl.querySelector('[data-role="custom-label"]').hidden = reasonSelect.value !== '__custom';
    });
    bodyEl.querySelector('[data-role="custom-label"]').hidden = true;

    bodyEl.querySelector('[data-role="start-delay"]').addEventListener('click', () => {
      try {
        const reasonId = reasonSelect.value === '__custom' ? null : reasonSelect.value;
        const customLabel =
          reasonSelect.value === '__custom'
            ? bodyEl.querySelector('[data-role="custom-label"]').value
            : null;
        store.startDelay(operation.id, {
          reasonId,
          customLabel,
          note: bodyEl.querySelector('[data-role="delay-note"]').value,
        });
        render();
      } catch (err) {
        delayError.textContent = err.message;
      }
    });

    bodyEl.querySelector('[data-role="close-delay"]').addEventListener('click', () => {
      try {
        store.closeDelay(openDelay.id);
        render();
      } catch (err) {
        delayError.textContent = err.message;
      }
    });

    bodyEl.querySelector('[data-role="correct-delay"]').addEventListener('click', () => {
      modalRoot.appendChild(DelayCorrectionDialog(store, operation.id, { onClose: render }));
    });

    for (const button of bodyEl.querySelectorAll('[data-counter]')) {
      button.addEventListener('click', () => {
        try {
          const delta = button.getAttribute('data-counter') === 'inc' ? 1 : -1;
          store.adjustShiftCounter(operation.id, delta);
          render();
        } catch (err) {
          errorEl.textContent = err.message;
        }
      });
    }
    const setButton = bodyEl.querySelector('[data-role="set-counter"]');
    setButton.addEventListener('click', () => {
      try {
        store.setShiftCounter(
          operation.id,
          parseDecimal(bodyEl.querySelector('[data-role="counter-input"]').value, {
            required: true,
            min: 0,
            decimals: 0,
            label: 'El contador del turno',
          }),
        );
        render();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  function openFinishConfirmation(operation) {
    const shift = store.activeShiftFor(operation.id);
    const openDelays = store
      .delaysForOperation(operation.id)
      .filter((delay) => delay.status === 'open');
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-role="finish-confirmation">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="finish-title">
          <h2 id="finish-title">Confirmar cierre de operación</h2>
          <p>Piezas del turno: <strong>${fmtNumber(shift ? shift.quantity_counted : 0)}</strong></p>
          <p>Atrasos abiertos: <strong>${openDelays.length}</strong></p>
          <p class="form-error" data-role="error" role="alert"></p>
          <div class="modal-actions">
            <button type="button" class="btn" data-role="cancel-finish">Cancelar</button>
            <button type="button" class="btn btn--primary" data-role="confirm-finish">Finalizar</button>
          </div>
        </div>
      </div>`;
    const close = () => {
      modalRoot.innerHTML = '';
    };
    modalRoot.querySelector('[data-role="cancel-finish"]').addEventListener('click', close);
    modalRoot.querySelector('[data-role="confirm-finish"]').addEventListener('click', () => {
      try {
        const result = store.finishOperation(operation.id);
        close();
        render();
        if (result.openDelays.length > 0) {
          modalRoot.appendChild(DelayCorrectionDialog(store, operation.id, { onClose: render }));
        }
      } catch (err) {
        modalRoot.querySelector('[data-role="error"]').textContent = err.message;
      }
    });
    modalRoot.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  }

  function render() {
    renderSelect();
    renderBody();
  }

  selectEl.addEventListener('change', () => {
    selectedOperationId = selectEl.value;
    renderBody();
  });
  store.addEventListener('change', render);
  render();
  return root;
}
