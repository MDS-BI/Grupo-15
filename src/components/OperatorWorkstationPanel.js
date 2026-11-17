/**
 * @file Estación de trabajo del operador (US-06): botón alterno, cronómetro,
 * atrasos justificados y contadores de turno/acumulado.
 */

import { escapeHtml, el, fmtNumber, OP_STATUS_LABEL } from './format.js';
import { elapsedMinutes, sumClosedDelayMinutes } from '../domain/shift-tracking.js';
import { DelayCorrectionDialog } from './DelayCorrectionDialog.js';

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
        return `<option value="${op.id}">${escapeHtml(order ? order.order_number : op.production_order_id)} · op ${op.sequence} (${OP_STATUS_LABEL[op.status]})</option>`;
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
      .map((reason) => `<option value="${reason.id}">${escapeHtml(reason.label)}</option>`)
      .join('');

    const delayRows = delays
      .map((delay) => {
        const reason = store.delayReasons.find((row) => row.id === delay.delay_reason_id);
        return `<tr data-delay-row="${delay.id}">
          <td>${escapeHtml(reason ? reason.label : delay.delay_reason_id)}</td>
          <td>${escapeHtml(delay.started_at)}</td>
          <td>${delay.duration_minutes != null ? fmtNumber(delay.duration_minutes, 2) : 'Abierto'}</td>
          <td>${delay.status === 'open' ? '<span class="badge badge--warn">Abierto — pendiente de corrección</span>' : 'Cerrado'}</td>
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
        <article class="panel">
          <header class="panel__header">
            <h2>${escapeHtml(order ? order.order_number : operation.production_order_id)} · ${escapeHtml(workCenter ? workCenter.name : operation.work_center_id)}</h2>
            <p class="panel__subtitle">${escapeHtml(store.productById(order?.product_id)?.name || '')}</p>
          </header>
          <div class="panel__body">
            <div class="operator-summary">
              <div class="mini-stat"><span class="mini-stat__value" data-role="timer">${fmtNumber(timerMinutes, 2)} min</span><span class="mini-stat__label">Tiempo efectivo del turno</span></div>
              <div class="mini-stat"><span class="mini-stat__value">${fmtNumber(operation.planned_time_minutes)}</span><span class="mini-stat__label">Tiempo planificado</span></div>
              <div class="mini-stat"><span class="mini-stat__value">${fmtNumber(operation.delay_time_minutes || 0, 2)}</span><span class="mini-stat__label">Atrasos cerrados</span></div>
              <div class="mini-stat"><span class="mini-stat__value">${fmtNumber(operation.quantity_completed)} / ${fmtNumber(order ? order.quantity_planned : 0)}</span><span class="mini-stat__label">Avance acumulado</span></div>
            </div>
            <div class="detail-actions">
              <button type="button" class="btn btn--primary" data-role="toggle" aria-pressed="${operation.status === 'in_progress'}" ${operation.status === 'completed' ? 'disabled' : ''}>${toggleText}</button>
            </div>
            <p class="form-error" data-role="error" role="alert"></p>
          </div>
        </article>

        <article class="panel">
          <header class="panel__header"><h3>Contadores</h3></header>
          <div class="panel__body">
            <div class="counter-row">
              <span>Turno: <strong data-role="shift-counter">${fmtNumber(shift ? shift.quantity_counted : 0)}</strong></span>
              <button type="button" class="btn btn--tiny" data-counter="dec">−</button>
              <input type="number" min="0" step="1" data-role="counter-input" value="${shift ? shift.quantity_counted : 0}" ${shift ? '' : 'disabled'} />
              <button type="button" class="btn btn--tiny" data-counter="inc">+</button>
              <button type="button" class="btn btn--tiny" data-role="set-counter" ${shift ? '' : 'disabled'}>Fijar</button>
            </div>
            <p class="counter-row">Acumulado: <strong data-role="cumulative-counter">${fmtNumber(operation.quantity_completed)}</strong></p>
          </div>
        </article>

        <article class="panel">
          <header class="panel__header"><h3>Atrasos justificados</h3></header>
          <div class="panel__body">
            <div class="table-wrap">
              <table class="data-table data-table--compact">
                <thead><tr><th>Motivo</th><th>Inicio</th><th>Duración</th><th>Estado</th></tr></thead>
                <tbody>${delayRows || '<tr><td colspan="4" class="empty-cell">Sin atrasos.</td></tr>'}</tbody>
              </table>
            </div>
            <div class="stack-form">
              <label>Motivo
                <select data-role="delay-reason" ${shift ? '' : 'disabled'}>
                  <option value="">Selecciona…</option>${reasonOptions}
                  <option value="__custom">Nuevo motivo…</option>
                </select>
              </label>
              <label>Motivo personalizado
                <input type="text" data-role="custom-label" placeholder="Etiqueta del motivo" />
              </label>
              <label>Nota
                <input type="text" data-role="delay-note" placeholder="Detalle opcional" />
              </label>
              <div class="detail-actions">
                <button type="button" class="btn" data-role="start-delay" ${shift && !openDelay ? '' : 'disabled'}>Registrar atraso</button>
                <button type="button" class="btn btn--primary" data-role="close-delay" ${openDelay ? '' : 'disabled'}>Finalizar atraso</button>
                <button type="button" class="btn" data-role="correct-delay" ${operation.status === 'completed' && openDelay ? '' : 'disabled'}>Corregir atraso abierto</button>
              </div>
            </div>
            <p class="form-error" data-role="delay-error" role="alert"></p>
          </div>
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
          bodyEl.querySelector('[data-role="counter-input"]').value,
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
